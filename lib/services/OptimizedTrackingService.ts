// lib/services/OptimizedTrackingService.ts

import openSkyTrackingService from './openSkyTrackingService';
import icaoManagementService from './IcaoManagementService';

/**
 * This service coordinates between OpenSkyTrackingService and IcaoManagementService
 * to optimize API usage without creating circular dependencies
 */
class OptimizedTrackingService {
  private activeIcao24s: Set<string> = new Set();
  private lastFullRefreshTime: number = 0;
  private fullRefreshInterval: number = 3600000; // 1 hour
  private useOptimization: boolean = true;

  /**
   * Initialize the optimization service
   */
  constructor() {
    console.log('[Optimizer] Initialization complete');
  }

  // Add these methods to OptimizedTrackingService class

  /**
   * Alias for refreshPositions to maintain API compatibility
   */
  public async refreshPositionsOnly(): Promise<any> {
    return this.refreshPositions();
  }

  /**
   * Immediate refresh (alias for refreshPositions)
   */
  public async refreshNow(): Promise<any> {
    console.log('[Optimizer] Performing immediate refresh');
    return this.refreshPositions();
  }

  /**
   * Start tracking a manufacturer with optimization
   */
  public async trackManufacturer(manufacturer: string): Promise<void> {
    console.log(`[Optimizer] Starting optimized tracking for ${manufacturer}`);

    // Reset optimization state
    this.activeIcao24s.clear();
    this.lastFullRefreshTime = 0;

    // Perform the regular tracking through openSkyTrackingService
    const aircraft =
      await openSkyTrackingService.trackManufacturer(manufacturer);

    // Update our active set
    this.updateActiveAircraftSet(aircraft);

    // Set last full refresh time
    this.lastFullRefreshTime = Date.now();

    console.log(
      `[Optimizer] Initial tracking complete, ${this.activeIcao24s.size} active aircraft`
    );
  }

  /**
   * Update the set of active aircraft
   */
  private updateActiveAircraftSet(aircraft: any[]): void {
    this.activeIcao24s.clear();

    let activeCount = 0;
    aircraft.forEach((plane) => {
      if (plane.icao24 && plane.latitude && plane.longitude) {
        this.activeIcao24s.add(plane.icao24.toLowerCase());
        activeCount++;
      }
    });

    console.log(
      `[Optimizer] Updated active set: ${activeCount} of ${aircraft.length} have position data`
    );
  }

  /**
   * Optimize position refresh
   */
  public async refreshPositions(): Promise<void> {
    if (!this.useOptimization) {
      console.log('[Optimizer] Optimization disabled, using standard refresh');
      await openSkyTrackingService.refreshPositionsOnly();
      return;
    }

    // Check if we need a full refresh
    const needsFullRefresh =
      this.activeIcao24s.size === 0 ||
      Date.now() - this.lastFullRefreshTime >= this.fullRefreshInterval;

    if (needsFullRefresh) {
      console.log(
        '[Optimizer] Performing full refresh to discover active aircraft'
      );

      // Use standard refresh
      await openSkyTrackingService.refreshPositionsOnly();

      // Update active set from the refreshed data
      this.updateActiveAircraftSet(openSkyTrackingService.getTrackedAircraft());

      // Update last full refresh time
      this.lastFullRefreshTime = Date.now();
    } else {
      console.log(
        `[Optimizer] Performing optimized refresh for ${this.activeIcao24s.size} active aircraft`
      );

      // Get the current manufacturer
      const manufacturer = openSkyTrackingService.getCurrentManufacturer();

      if (!manufacturer) {
        console.log('[Optimizer] No manufacturer to refresh');
        return;
      }

      // Only request active aircraft
      const activeIcaos = Array.from(this.activeIcao24s);

      // Use your existing refresh mechanism but with only active ICAOs
      // This code might need adjustment based on your actual implementation
      await icaoManagementService
        .trackAircraft(activeIcaos, manufacturer)
        .then((aircraft) => {
          // Update OpenSky tracking service with the refreshed data
          openSkyTrackingService.getTrackedAircraft();

          // Update our active set
          this.updateActiveAircraftSet(aircraft);
        });
    }
  }

  /**
   * Enable or disable optimization
   */
  public setOptimization(enabled: boolean): void {
    this.useOptimization = enabled;
    console.log(`[Optimizer] Optimization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set full refresh interval
   */
  public setFullRefreshInterval(minutes: number): void {
    const minMinutes = 10;
    const validMinutes = Math.max(minMinutes, minutes);
    this.fullRefreshInterval = validMinutes * 60 * 1000;
    console.log(
      `[Optimizer] Full refresh interval set to ${validMinutes} minutes`
    );
  }

  /**
   * Get optimization stats
   */
  public getStats(): {
    activeCount: number;
    nextFullRefreshIn: number;
    optimizationEnabled: boolean;
  } {
    const nextFullRefreshIn = Math.max(
      0,
      Math.floor(
        (this.lastFullRefreshTime + this.fullRefreshInterval - Date.now()) /
          60000
      )
    );

    return {
      activeCount: this.activeIcao24s.size,
      nextFullRefreshIn,
      optimizationEnabled: this.useOptimization,
    };
  }
}

const optimizedTrackingService = new OptimizedTrackingService();
export default optimizedTrackingService;
