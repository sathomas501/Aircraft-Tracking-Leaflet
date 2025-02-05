import { errorHandler, ErrorType } from './error-handler';
import { PollingRateLimiter } from './rate-limiter';
import { extrapolatePosition } from './extrapolation';

export interface Position {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  on_ground: boolean;
  last_contact: number;
}

export class AircraftPositionService {
  private static instance: AircraftPositionService;
  private positions: Map<string, Position> = new Map();
  private positionHistory: Map<string, Position[]> = new Map();
  private positionExpiryTime = 5 * 60 * 1000; // 5 minutes
  private maxHistoryLength = 10; // Keep last 10 positions for trails
  private cleanupInterval: NodeJS.Timeout | null = null;
  private rateLimiter: PollingRateLimiter;

  private constructor() {
    this.rateLimiter = new PollingRateLimiter({
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      minPollingInterval: 5000,
      maxPollingInterval: 30000,
    });
    this.startCleanupRoutine();
  }

  public static getInstance(): AircraftPositionService {
    if (!AircraftPositionService.instance) {
      AircraftPositionService.instance = new AircraftPositionService();
    }
    return AircraftPositionService.instance;
  }

  private startCleanupRoutine(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      this.positions.forEach((pos, icao24) => {
        if (now - pos.last_contact > this.positionExpiryTime) {
          this.positions.delete(icao24);
          this.positionHistory.delete(icao24);
        }
      });
    }, 60000); // Clean up every 60 seconds
  }

  private shouldUpdatePosition(currentPos: Position, newPos: Position): boolean {
    const minUpdateDistance = 10; // meters
    const minUpdateTime = 1000; // milliseconds

    if (newPos.last_contact - currentPos.last_contact > minUpdateTime) {
      return true;
    }

    const R = 6371e3;
    const φ1 = currentPos.latitude * Math.PI / 180;
    const φ2 = newPos.latitude * Math.PI / 180;
    const Δφ = (newPos.latitude - currentPos.latitude) * Math.PI / 180;
    const Δλ = (newPos.longitude - currentPos.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2;
    const distance = R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    return distance > minUpdateDistance;
  }

  public getPosition(icao24: string): Position | null {
    const position = this.positions.get(icao24);
    return position && Date.now() - position.last_contact < this.positionExpiryTime
      ? position
      : null;
  }

  public getPositionHistory(icao24: string): Position[] {
    return this.positionHistory.get(icao24) || [];
  }

  public updatePosition(position: Position): void {
    const currentPos = this.positions.get(position.icao24);

    if (!currentPos || this.shouldUpdatePosition(currentPos, position)) {
      this.positions.set(position.icao24, position);

      const history = this.positionHistory.get(position.icao24) || [];
      if (
        !history.length ||
        history[history.length - 1].latitude !== position.latitude ||
        history[history.length - 1].longitude !== position.longitude
      ) {
        history.push(position);
        if (history.length > this.maxHistoryLength) {
          history.shift();
        }
        this.positionHistory.set(position.icao24, history);
      }
    }
  }

  // 🔄 Batch Update for Multiple Aircraft via Proxy
  public async batchUpdate(icao24List: string[]): Promise<void> {
    try {
      const response = await fetch(
        `/api/proxy/opensky?icao24=${icao24List.join(',')}`
      );
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      
      if (!data.states) {
        throw new Error('Invalid response format: missing states array');
      }
  
      data.states.forEach((state: any) => {
        const position: Position = {
          icao24: state[0],
          latitude: state[6],
          longitude: state[5],
          altitude: state[7],
          velocity: state[9],
          heading: state[10],
          on_ground: state[8],
          last_contact: state[4],
        };
        this.updatePosition(position);
      });
    } catch (error) {
      if (error instanceof Error) {
        errorHandler.handleError(ErrorType.OPENSKY_SERVICE, error);
      } else {
        errorHandler.handleError(ErrorType.OPENSKY_SERVICE, new Error(String(error)));
      }
    }
  }}