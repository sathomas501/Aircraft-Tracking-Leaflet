import axios from 'axios';
import NodeCache from 'node-cache';

// Use environment-specific WebSocket
const WebSocketConstructor = typeof window !== 'undefined' ? window.WebSocket : require('ws');

interface PositionData {
  [icao24: string]: {
    icao24: string;
    latitude: number | undefined;
    longitude: number | undefined;
    velocity: number | undefined;
    heading: number | undefined;
    altitude: number | undefined;
    on_ground: boolean | undefined;
    last_contact: number | undefined;
  };
}

class OpenSkyService {
  private cache: NodeCache;
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private username: string;
  private password: string;
  private isWebSocketEnabled: boolean;
  private wsReconnectAttempts = 0;
  private readonly maxWsReconnectAttempts = 5;

  constructor(username: string, password: string, isWebSocketEnabled = true) {
    this.cache = new NodeCache({ stdTTL: 15 });
    this.username = username;
    this.password = password;
    this.isWebSocketEnabled = isWebSocketEnabled;

    if (isWebSocketEnabled && typeof window === 'undefined') {
      this.initWebSocket();
    }
  }

  private initWebSocket() {
    if (!this.isWebSocketEnabled || this.ws) return;

    try {
      const wsUrl = `wss://opensky-network.org/ws`;
      this.ws = new WebSocketConstructor(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connection established');
        this.wsReconnectAttempts = 0;
        this.subscribeToUpdates();
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.ws?.close();
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private handleWebSocketMessage(data: any) {
    try {
      const positions = JSON.parse(data);
      this.cache.set('positions', positions);
      console.log('Positions updated');
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }

  private scheduleReconnect() {
    if (this.wsReconnectAttempts >= this.maxWsReconnectAttempts) {
      console.log('Max reconnection attempts reached. WebSocket disabled.');
      this.isWebSocketEnabled = false;
      return;
    }

    this.wsReconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      console.log('Reconnecting WebSocket...');
      this.initWebSocket();
    }, 5000);
  }

  private subscribeToUpdates() {
    if (this.ws && this.ws.readyState === WebSocketConstructor.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', filters: { states: true } }));
    }
  }

  public async getPositions(): Promise<PositionData> {
    const url = 'https://opensky-network.org/api/states/all';
    try {
      const response = await axios.get(url, {
        auth: { username: this.username, password: this.password },
      });
      const data = response.data.states || [];
      return data.reduce((acc: PositionData, state: any[]) => {
        acc[state[0]] = {
          icao24: state[0],
          latitude: state[6],
          longitude: state[5],
          altitude: state[7],
          velocity: state[9],
          heading: state[10],
          on_ground: state[8],
          last_contact: state[4],
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }
}

export const openSkyService = new OpenSkyService(
  process.env.NEXT_PUBLIC_OPENSKY_USERNAME || '',
  process.env.NEXT_PUBLIC_OPENSKY_PASSWORD || ''
);
