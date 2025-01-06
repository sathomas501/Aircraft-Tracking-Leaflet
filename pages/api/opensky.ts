import axios from 'axios';
import WebSocket from 'ws';
import NodeCache from 'node-cache';

export interface PositionData {
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

export class OpenSkyService {
  private cache: NodeCache;
  private wsClients: Set<WebSocket>;
  private currentEndpointIndex: number;
  private lastRequestTime: number;
  private readonly username: string;
  private readonly password: string;
  public readonly wsEnabled: boolean;

  constructor(username: string, password: string, wsEnabled = true) {
    this.cache = new NodeCache({ stdTTL: 15 });
    this.wsClients = new Set();
    this.currentEndpointIndex = 0;
    this.lastRequestTime = 0;
    this.username = username;
    this.password = password;
    this.wsEnabled = wsEnabled;

    if (this.wsEnabled) {
      this.initializeWebSocket('wss://opensky-network.org/ws');
    }
  }

  private initializeWebSocket(url: string) {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket connection opened');
      this.wsClients.add(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '');
        console.log('Received WebSocket message:', data);
        // Handle incoming position updates
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.wsClients.delete(ws);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  public subscribeToPositions(icao24s: string[]): () => void {
    if (!this.wsClients || this.wsClients.size === 0) {
      throw new Error('WebSocket is not initialized or no active connections');
    }

    const message = {
      type: 'subscribe',
      icao24s: icao24s,
    };

    const serializedMessage = JSON.stringify(message);

    this.wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serializedMessage);
        console.log('Subscribed to positions:', icao24s);
      } else {
        console.warn('WebSocket not open. Cannot subscribe.');
      }
    });

    return () => {
      const unsubscribeMessage = {
        type: 'unsubscribe',
        icao24s: icao24s,
      };

      const serializedUnsubscribeMessage = JSON.stringify(unsubscribeMessage);

      this.wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(serializedUnsubscribeMessage);
          console.log('Unsubscribed from positions:', icao24s);
        } else {
          console.warn('WebSocket not open. Cannot unsubscribe.');
        }
      });
    };
  }

  public async fetchPositions(): Promise<PositionData> {
    const endpoint = `https://opensky-network.org/api/states/all`;
    const auth = {
      username: this.username,
      password: this.password,
    };

    try {
      const response = await axios.get(endpoint, { auth });
      const data = response.data;

      this.cache.set('positions', data);
      console.log('Fetched positions from API');
      return data;
    } catch (error) {
      console.error('Error fetching positions from API:', error);
      throw error;
    }
  }

  public disconnect() {
    this.wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    console.log('Disconnected all WebSocket clients');
  }
}
