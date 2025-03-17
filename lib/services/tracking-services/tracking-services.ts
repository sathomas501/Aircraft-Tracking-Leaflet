// lib/services/tracking-services.ts
// This file serves as the main entry point for all aircraft tracking services

import { BaseTrackingService } from './base-tracking-service';
import {
  ClientTrackingService,
  clientTrackingService,
} from './client-tracking-service';
import { TrackingDataService } from './tracking-data-service';
import { aircraftPositionService, Position } from './aircraft-position-service';
import type { Aircraft, OpenSkyStateArray } from '@/types/base';
import { TrackingDatabaseManager } from '@/lib/db/managers/trackingDatabaseManager';
import { manufacturerTracking } from '../tracking-services/manufacturer-tracking-service';

/**
 * Tracking Services provides a simplified interface to access all aircraft tracking functionality
 * This is a facade pattern that coordinates between different tracking services
 */
export class TrackingServices {
  private static instance: TrackingServices;
  private clientService: ClientTrackingService;
  private dataService: TrackingDataService | null = null;
  private isServer: boolean;

  private constructor() {
    this.isServer = typeof window === 'undefined';
    this.clientService = clientTrackingService;

    // Initialize data service on server side if needed
    if (this.isServer) {
      this.initializeDatabase();
    }
  }

  public static async getInstance(): Promise<TrackingServices> {
    if (!TrackingServices.instance) {
      TrackingServices.instance = new TrackingServices();
      await TrackingServices.instance.initializeDatabase();
    }
    return TrackingServices.instance;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // ✅ Ensure database instance is awaited before usage
      const dbManager = await TrackingDatabaseManager.getInstance();

      // ✅ Ensure database is properly initialized
      await dbManager.initializeDatabase();
    } catch (initError) {
      console.error(
        '[TrackingServices] ❌ Failed to initialize database:',
        initError
      );
    }
  }

  /**
   * Get the appropriate tracking service based on environment
   * @private
   */
  private getActiveService(manufacturer: string): BaseTrackingService {
    // Use data service on server, client service on client
    return this.isServer && this.dataService
      ? this.dataService
      : this.clientService;
  }

  /**
   * Start tracking aircraft for a specific manufacturer
   * @param manufacturer Manufacturer name
   * @param pollInterval Optional poll interval in milliseconds (default: 30000)
   */
  public async startTracking(
    manufacturer: string,
    pollInterval?: number
  ): Promise<void> {
    const service = this.getActiveService(manufacturer);
    return service.startTracking(manufacturer, pollInterval);
  }

  /**
   * Stop tracking aircraft for a specific manufacturer
   * @param manufacturer Manufacturer name
   */
  public stopTracking(manufacturer: string): void {
    const service = this.getActiveService(manufacturer);
    return service.stopTracking(manufacturer);
  }

  /**
   * Get position for a specific aircraft
   * @param icao24 ICAO24 code for the aircraft
   */
  public getPosition(icao24: string): Position | undefined {
    return aircraftPositionService.getPosition(icao24);
  }

  /**
   * Get position history for a specific aircraft
   * @param icao24 ICAO24 code for the aircraft
   */
  public getPositionHistory(icao24: string): Position[] {
    return aircraftPositionService.getPositionHistory(icao24);
  }

  /**
   * Update aircraft positions
   * @param positions Aircraft position data
   * @param manufacturer Manufacturer name
   */
  public async updatePositions(
    positions: OpenSkyStateArray[],
    manufacturer: string
  ): Promise<number> {
    const service = this.getActiveService(manufacturer);
    return service.updatePositions(positions, manufacturer);
  }

  /**
   * Subscribe to aircraft updates for a manufacturer
   * @param manufacturer Manufacturer name
   * @param callback Function to call when aircraft are updated
   */
  public subscribe(
    manufacturer: string,
    callback: (data: Aircraft[]) => void
  ): () => void {
    const service = this.getActiveService(manufacturer);
    return service.subscribe(manufacturer, callback);
  }

  /**
   * Get ICAO24 codes for aircraft from a manufacturer
   * @param manufacturer Manufacturer name
   */
  public async getManufacturerIcao24s(manufacturer: string): Promise<string[]> {
    const service = this.getActiveService(manufacturer);
    return service.getManufacturerIcao24s(manufacturer);
  }
}

// Export all individual services for backward compatibility
export { aircraftPositionService, manufacturerTracking, clientTrackingService };

// Export singleton instance of the unified service
export const trackingServices = TrackingServices.getInstance();

// Export types for convenience
export type { Position };
export type { Aircraft };
