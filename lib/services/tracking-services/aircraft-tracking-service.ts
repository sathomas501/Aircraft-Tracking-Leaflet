// lib/services/aircraft-tracking-service.ts
import { Aircraft, OpenSkyStateArray, CachedAircraftData } from '@/types/base';
import { manufacturerTracking } from './manufacturer-tracking-service';

/**
 * @deprecated This service is being merged with ManufacturerTrackingService.
 * Please use manufacturerTracking directly for new code.
 */
export class AircraftTrackingService {
  private static instance: AircraftTrackingService | null = null;
  private readonly DEBUG = true;
  private static readonly BATCH_SIZE = 200;
  private trackedICAOs: Set<string> = new Set();

  private constructor() {
    console.warn(
      '[DEPRECATED] AircraftTrackingService is deprecated. Use ManufacturerTrackingService instead.'
    );
  }

  public static getInstance(): AircraftTrackingService {
    if (!AircraftTrackingService.instance) {
      AircraftTrackingService.instance = new AircraftTrackingService();
    }
    return AircraftTrackingService.instance;
  }

  /**
   * Process a manufacturer - fetch and return all aircraft for a manufacturer
   * @deprecated Use manufacturerTracking.processManufacturer() instead
   */
  public async processManufacturer(manufacturer: string): Promise<Aircraft[]> {
    return manufacturerTracking.processManufacturer(manufacturer);
  }

  /**
   * Update positions for multiple aircraft
   * @deprecated Use manufacturerTracking.updateAircraftPositions() instead
   */
  public async updateAircraftPositions(
    activeAircraft: OpenSkyStateArray[],
    manufacturer: string
  ): Promise<number> {
    return manufacturerTracking.updateAircraftPositions(
      activeAircraft,
      manufacturer
    );
  }

  /**
   * Start tracking for a manufacturer
   * @deprecated Use manufacturerTracking.startTracking() instead
   */
  public async startTrackingManufacturer(manufacturer: string): Promise<void> {
    return manufacturerTracking.startTracking(manufacturer);
  }

  /**
   * Destroy this service instance
   * @deprecated Use manufacturerTracking.destroy() instead
   */
  public destroy(): void {
    // Nothing to clean up in this facade
    console.warn(
      '[DEPRECATED] AircraftTrackingService.destroy() is deprecated. Use ManufacturerTrackingService.destroy() instead.'
    );
  }

  /**
   * Clean up resources
   * This method ensures backward compatibility with any code that may have called it
   */
  public cleanUpResources(): void {
    console.warn(
      '[DEPRECATED] AircraftTrackingService.cleanUpResources() is deprecated. Use ManufacturerTrackingService.destroy() instead.'
    );
  }
}

// Export singleton instance for backward compatibility
export const getAircraftTrackingService = () =>
  AircraftTrackingService.getInstance();
