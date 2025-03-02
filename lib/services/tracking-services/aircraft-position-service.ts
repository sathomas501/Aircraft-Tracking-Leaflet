// lib/services/aircraft-position-service.ts
import { BaseTrackingService } from './base-tracking-service';
import { Aircraft, OpenSkyStateArray } from '@/types/base';

export interface Position {
  icao24: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  velocity?: number;
  heading?: number;
  on_ground?: boolean;
  last_contact?: number;
  manufacturer?: string;
}

/**
 * Service for tracking and storing aircraft position data
 */
export class AircraftPositionService extends BaseTrackingService {
  private positions: Map<string, Position>;
  private positionHistory: Map<string, Position[]>;
  private historyLimit: number = 100;
  private static instance: AircraftPositionService;

  private constructor() {
    // Initialize with appropriate rate limiter options
    super({
      interval: 60000, // 1 minute in milliseconds
      retryAfter: 1000,
      requestsPerMinute: 60,
      requestsPerDay: 5000,
      maxWaitTime: 30000,
      minPollingInterval: 1000,
      maxPollingInterval: 10000,
      maxBatchSize: 100,
      retryLimit: 3,
      requireAuthentication: true,
      maxConcurrentRequests: 5,
    });

    this.positions = new Map();
    this.positionHistory = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AircraftPositionService {
    if (!AircraftPositionService.instance) {
      AircraftPositionService.instance = new AircraftPositionService();
    }
    return AircraftPositionService.instance;
  }

  /**
   * Implementation of required BaseTrackingService method
   * Start tracking aircraft for a manufacturer
   * @param manufacturer Manufacturer name
   * @param pollInterval Optional poll interval in milliseconds
   */
  public async startTracking(
    manufacturer: string,
    pollInterval?: number
  ): Promise<void> {
    console.log(
      `[AircraftPositionService] Started tracking positions for ${manufacturer}`
    );
    // This service doesn't need polling as it just provides position data
    // The tracking is done by other services that call updatePosition

    // Get any existing data for this manufacturer
    const icao24s = await this.getManufacturerIcao24s(manufacturer);

    // Notify subscribers if we have existing data
    const positions = this.getPositionsForManufacturer(manufacturer);
    if (positions.length > 0) {
      // Convert positions to Aircraft type for notification
      this.notifySubscribers(
        manufacturer,
        this.positionsToAircraft(positions, manufacturer)
      );
    }
  }

  /**
   * Implementation of required BaseTrackingService method
   * Stop tracking aircraft for a manufacturer
   * @param manufacturer Manufacturer name
   */
  public stopTracking(manufacturer: string): void {
    console.log(
      `[AircraftPositionService] Stopped tracking positions for ${manufacturer}`
    );
    // Nothing to stop, as this service is passive
  }

  /**
   * Implementation of required BaseTrackingService method
   * Get manufacturer ICAO24 codes
   * @param manufacturer Manufacturer name
   */
  public async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    // Get ICAO24s from positions that match this manufacturer
    const icao24s: string[] = [];

    for (const [icao24, position] of this.positions.entries()) {
      if (position.manufacturer === manufacturer) {
        icao24s.push(icao24);
      }
    }

    return icao24s;
  }

  /**
   * Get positions for a specific manufacturer
   */
  private getPositionsForManufacturer(manufacturer: string): Position[] {
    const positions: Position[] = [];

    for (const position of this.positions.values()) {
      if (position.manufacturer === manufacturer) {
        positions.push(position);
      }
    }

    return positions;
  }

  /**
   * Convert Position objects to Aircraft objects for compatibility with BaseTrackingService
   */
  private positionsToAircraft(
    positions: Position[],
    manufacturer: string
  ): Aircraft[] {
    return positions.map((position) => ({
      icao24: position.icao24,
      latitude: position.latitude,
      longitude: position.longitude,
      altitude: position.altitude || 0,
      velocity: position.velocity || 0,
      heading: position.heading || 0,
      on_ground: position.on_ground || false,
      last_contact: position.last_contact || Math.floor(Date.now() / 1000),
      manufacturer: position.manufacturer || manufacturer,
      'N-NUMBER': '',
      model: '',
      operator: '',
      NAME: '',
      CITY: '',
      STATE: '',
      OWNER_TYPE: '',
      created_at: new Date().toISOString(),
      TYPE_AIRCRAFT: '',
      isTracked: true,
    }));
  }

  /**
   * Update an aircraft's position
   * @param position Aircraft position data
   */
  public updatePosition(position: Position): void {
    if (!position || !position.icao24) {
      console.warn('[AircraftPositionService] Invalid position data');
      return;
    }

    // Update current position
    this.positions.set(position.icao24, {
      ...position,
      last_contact: position.last_contact || Math.floor(Date.now() / 1000),
    });

    // Update history
    if (!this.positionHistory.has(position.icao24)) {
      this.positionHistory.set(position.icao24, []);
    }

    const history = this.positionHistory.get(position.icao24)!;
    history.push({ ...position });

    // Limit history size
    if (history.length > this.historyLimit) {
      history.shift();
    }

    // If manufacturer is provided, notify subscribers
    if (position.manufacturer) {
      const manufacturer = position.manufacturer;

      // Create a batch notification on next tick to avoid too many notifications
      setTimeout(() => {
        const positions = this.getPositionsForManufacturer(manufacturer);
        const aircraft = this.positionsToAircraft(positions, manufacturer);
        this.notifySubscribers(manufacturer, aircraft);
      }, 0);
    }
  }

  /**
   * LocalUpdatePositions - different from the BaseTrackingService method
   * Update multiple aircraft positions
   * @param positions Array of position data
   */
  public updatePositionBatch(positions: Position[]): void {
    if (!positions || !positions.length) return;

    // Track manufacturers to notify
    const manufacturersToNotify = new Set<string>();

    // Update all positions
    for (const position of positions) {
      if (!position || !position.icao24) continue;

      this.updatePosition(position);

      if (position.manufacturer) {
        manufacturersToNotify.add(position.manufacturer);
      }
    }

    // Notify subscribers for each manufacturer - batch updates
    setTimeout(() => {
      for (const manufacturer of manufacturersToNotify) {
        const positions = this.getPositionsForManufacturer(manufacturer);
        const aircraft = this.positionsToAircraft(positions, manufacturer);
        this.notifySubscribers(manufacturer, aircraft);
      }
    }, 0);
  }

  /**
   * Implementation of BaseTrackingService updatePositions method
   * Process OpenSky data and update positions
   * @param openSkyStates Array of OpenSky state arrays
   * @param manufacturer Manufacturer name
   */
  public async updatePositions(
    openSkyStates: OpenSkyStateArray[],
    manufacturer: string
  ): Promise<number> {
    if (!openSkyStates || openSkyStates.length === 0) return 0;

    let updatedCount = 0;

    try {
      // Convert OpenSky states to Position format
      const positions: Position[] = openSkyStates.map((state) => ({
        icao24: state[0],
        latitude: state[6],
        longitude: state[5],
        altitude: state[7],
        velocity: state[9],
        heading: state[10],
        on_ground: state[8],
        last_contact: state[4],
        manufacturer,
      }));

      // Update positions
      for (const position of positions) {
        this.updatePosition(position);
        updatedCount++;
      }

      // Notify subscribers
      const updatedPositions = this.getPositionsForManufacturer(manufacturer);
      const aircraft = this.positionsToAircraft(updatedPositions, manufacturer);
      this.notifySubscribers(manufacturer, aircraft);

      return updatedCount;
    } catch (error) {
      console.error(
        '[AircraftPositionService] Error updating positions:',
        error
      );
      return 0;
    }
  }

  /**
   * Get current position for an aircraft
   * @param icao24 Aircraft ICAO24 code
   */
  public getPosition(icao24: string): Position | undefined {
    return this.positions.get(icao24);
  }

  /**
   * Get position history for an aircraft
   * @param icao24 Aircraft ICAO24 code
   */
  public getPositionHistory(icao24: string): Position[] {
    return this.positionHistory.get(icao24) || [];
  }

  /**
   * Set history limit
   * @param limit Maximum number of positions to store in history
   */
  public setHistoryLimit(limit: number): void {
    this.historyLimit = limit;
  }

  /**
   * Clear position data for an aircraft
   * @param icao24 Aircraft ICAO24 code
   */
  public clearPosition(icao24: string): void {
    this.positions.delete(icao24);
    this.positionHistory.delete(icao24);
  }

  /**
   * Clear all position data
   */
  public clearAllPositions(): void {
    this.positions.clear();
    this.positionHistory.clear();
  }

  /**
   * Cleanup method required by BaseTrackingService
   */
  public destroy(): void {
    this.clearAllPositions();
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const aircraftPositionService = AircraftPositionService.getInstance();
