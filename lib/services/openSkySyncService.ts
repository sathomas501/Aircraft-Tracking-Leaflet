// lib/services/openSkySyncService.ts
import { Aircraft } from '@/types/base';
import UnifiedCacheService from '@/lib/services/managers/unified-cache-system';
import { PollingRateLimiter } from './rate-limiter';
import { errorHandler, ErrorType } from './error-handler';
import { DatabaseTransforms } from '@/utils/aircraft-transform';

export class OpenSkySyncService {
  private static instance: OpenSkySyncService;
  private cache: UnifiedCacheService;
  private rateLimiter: PollingRateLimiter;
  private dbManager: any; // Use dynamic loading
  private isPolling: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  private readonly POLLING_DELAY = 5000; // 5 seconds
  private readonly MAX_BATCH_SIZE = 100;
  private readonly STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    this.cache = UnifiedCacheService.getInstance();
    this.rateLimiter = new PollingRateLimiter({
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      minPollingInterval: 5000,
      maxPollingInterval: 30000,
    });

    if (typeof window === 'undefined') {
      const {
        TrackingDatabaseManager,
      } = require('@/lib/db/trackingDatabaseManager'); // ✅ Dynamically load it
      this.dbManager = TrackingDatabaseManager.getInstance();
    }
  }

  public static getInstance(): OpenSkySyncService {
    if (!OpenSkySyncService.instance) {
      OpenSkySyncService.instance = new OpenSkySyncService();
    }
    return OpenSkySyncService.instance;
  }

  private async processAircraftData(aircraft: Aircraft): Promise<void> {
    try {
      if (!this.dbManager) {
        throw new Error(
          '[OpenSkySyncService] Database manager is not initialized on client side.'
        );
      }

      this.cache.setLiveData(aircraft.icao24, [aircraft]);

      const trackingData = DatabaseTransforms.toTracking(aircraft);
      await this.dbManager.upsertActiveAircraftBatch([trackingData]);
    } catch (error) {
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        'Error processing aircraft data',
        { error, icao24: aircraft.icao24 }
      );
      throw error;
    }
  }

  private async processBatch(aircraftBatch: Aircraft[]): Promise<void> {
    if (!aircraftBatch.length) return;

    try {
      if (!(await this.rateLimiter.tryAcquire())) {
        console.log('[OpenSkySync] Rate limited, waiting for next slot');
        return;
      }

      // Parallel processing with original Aircraft objects
      await Promise.all([
        // Update cache with Aircraft objects
        ...aircraftBatch.map((aircraft) =>
          this.cache.setLiveData(aircraft.icao24, [aircraft])
        ),
        // Transform and update database
        this.dbManager.upsertActiveAircraftBatch(
          aircraftBatch.map(DatabaseTransforms.toTracking)
        ),
      ]);

      this.rateLimiter.recordSuccess();
    } catch (error) {
      this.rateLimiter.recordFailure();
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        'Error processing aircraft batch',
        { error, batchSize: aircraftBatch.length }
      );
      throw error;
    }
  }

  public async startSync(aircraft: Aircraft[]): Promise<void> {
    if (this.isPolling) {
      console.log('[OpenSkySync] Sync already in progress');
      return;
    }

    this.isPolling = true;
    console.log(`[OpenSkySync] Starting sync for ${aircraft.length} aircraft`);

    try {
      // Process in batches
      for (let i = 0; i < aircraft.length; i += this.MAX_BATCH_SIZE) {
        const batch = aircraft.slice(i, i + this.MAX_BATCH_SIZE);
        await this.processBatch(batch);

        // Add delay between batches if more remain
        if (i + this.MAX_BATCH_SIZE < aircraft.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.POLLING_DELAY)
          );
        }
      }

      this.startPolling(aircraft);
    } catch (error) {
      this.stopSync(); // Ensure cleanup on error
      errorHandler.handleError(
        ErrorType.OPENSKY_SERVICE,
        'Error starting sync',
        { error, aircraftCount: aircraft.length }
      );
    }
  }

  private startPolling(aircraft: Aircraft[]): void {
    this.stopPolling(); // Clear any existing interval

    this.pollingInterval = setInterval(async () => {
      try {
        await this.processBatch(aircraft);
      } catch (error) {
        errorHandler.handleError(
          ErrorType.OPENSKY_POLLING,
          'Error during polling',
          { error, aircraftCount: aircraft.length }
        );
      }
    }, this.POLLING_DELAY);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  public stopSync(): void {
    console.log('[OpenSkySync] Stopping sync');
    this.isPolling = false;
    this.stopPolling();
  }

  public isActive(): boolean {
    return this.isPolling;
  }

  public getCache(): UnifiedCacheService {
    return this.cache;
  }

  public async cleanup(): Promise<void> {
    this.stopSync();
    this.cache.clearCache();

    try {
      const staleAircraft = await this.dbManager.getStaleAircraft();
      await Promise.all(
        staleAircraft.map(async (aircraft: { icao24: string }) => {
          await this.dbManager.deleteAircraft(aircraft.icao24);
        })
      );
    } catch (error) {
      errorHandler.handleError(
        ErrorType.OPENSKY_CLEANUP,
        'Error during cleanup',
        { error }
      );
    }
  }
}
