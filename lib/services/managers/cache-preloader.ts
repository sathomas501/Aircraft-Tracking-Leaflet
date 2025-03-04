// lib/services/managers/cache-preloader.ts
import { errorHandler, ErrorType } from '../error-handler/error-handler';

interface Region {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
  description: string;
}

interface PreloadConfig {
  regions?: Region[];
  manufacturers?: string[];
  maxAircraftPerRegion?: number;
}

class CachePreloaderService {
  private static instance: CachePreloaderService;
  private isPreloading: boolean = false;
  private preloadProgress: number = 0;
  private progressListeners: Set<(progress: number) => void> = new Set();

  private defaultConfig: PreloadConfig = {
    regions: [
      {
        lamin: 24.396308,
        lomin: -125.0,
        lamax: 49.384358,
        lomax: -66.93457,
        description: 'Continental US',
      },
    ],
    maxAircraftPerRegion: 500,
  };

  private constructor() {}

  static getInstance(): CachePreloaderService {
    if (!CachePreloaderService.instance) {
      CachePreloaderService.instance = new CachePreloaderService();
    }
    return CachePreloaderService.instance;
  }

  async preloadCache(
    config: PreloadConfig = this.defaultConfig
  ): Promise<void> {
    if (this.isPreloading) {
      throw new Error('Preload already in progress');
    }

    this.isPreloading = true;
    this.preloadProgress = 0;
    this.updateProgress(0);

    try {
      const regions = config.regions || this.defaultConfig.regions || [];
      const totalRegions = regions.length;

      for (let i = 0; i < totalRegions; i++) {
        const region = regions[i];
        try {
          await this.preloadRegion(region, config.maxAircraftPerRegion);
          this.updateProgress(((i + 1) / totalRegions) * 100);
        } catch (error) {
          errorHandler.handleError(
            ErrorType.DATA,
            error instanceof Error
              ? error
              : new Error('Unknown error occurred'),
            { region: region.description }
          );
        }

        if (i < totalRegions - 1) {
          await this.delay(10000); // Wait between regions
        }
      }

      if (config.manufacturers?.length) {
        await this.preloadManufacturers(config.manufacturers);
      }
    } finally {
      this.isPreloading = false;
      this.updateProgress(100);
    }
  }

  private async preloadRegion(
    region: Region,
    maxAircraft: number = 500
  ): Promise<void> {
    try {
      const response = await fetch('/api/aircraft/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, maxAircraft }),
      });

      if (!response.ok) {
        throw new Error(`Failed to preload region: ${response.statusText}`);
      }

      const data = await response.json();
      const validData = data.map((item: any) => ({
        icao24: item.icao24,
        latitude: item.latitude || 0,
        longitude: item.longitude || 0,
        altitude: item.altitude || 0,
        velocity: item.velocity || 0,
        heading: item.heading || 0,
        on_ground: item.on_ground || false,
        last_contact: item.last_contact || Date.now() / 1000,
        manufacturer: item.manufacturer || 'Unknown',
      }));

      // Replace or remove the following line as necessary
      // unifiedCache.updateFromPolling(validData); // Removed
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Preloading failed for region ${region.description}: ${errorMessage}`
      );
    }
  }

  private async preloadManufacturers(manufacturers: string[]): Promise<void> {
    const processedManufacturers = new Set<string>(); // ✅ Prevent redundant requests

    for (const manufacturer of manufacturers) {
      if (processedManufacturers.has(manufacturer)) {
        console.log(
          `[Preload] ✅ Skipping duplicate fetch for ${manufacturer}`
        );
        continue; // ✅ Skip if already processed
      }

      try {
        console.log(`[Preload] 🔄 Fetching ICAO24s for ${manufacturer}`);

        const response = await fetch(
          `/api/aircraft/manufacturers/icao24s?manufacturer=${manufacturer}`
        );
        if (!response.ok) {
          console.warn(
            `[Preload] ❌ Failed to fetch ICAO24s for ${manufacturer}`
          );
          continue;
        }

        const { icao24List } = await response.json();
        if (icao24List?.length) {
          console.log(
            `[Preload] ✅ Found ${icao24List.length} ICAO24s for ${manufacturer}`
          );

          // ✅ Batch ICAO24 tracking requests instead of individual calls
          const positions = await fetch(`/api/aircraft/tracking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ icao24s: icao24List }),
          });

          if (positions.ok) {
            const data = await positions.json();
            console.log(
              `[Preload] ✅ Successfully preloaded tracking data for ${manufacturer}`
            );
            // unifiedCache.updateFromRest(manufacturer, data); // ✅ Optionally store data in cache
          }
        }

        // ✅ Mark as processed to prevent duplicate requests
        processedManufacturers.add(manufacturer);
      } catch (error) {
        console.error(`[Preload] ❌ Error processing ${manufacturer}:`, error);
        errorHandler.handleError(
          ErrorType.DATA,
          error instanceof Error ? error : new Error('Unknown error occurred'),
          { manufacturer }
        );
      }

      // ✅ Apply a rate limit to avoid overloading API
      await this.delay(5000); // Reduced delay to optimize performance
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  onProgress(listener: (progress: number) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private updateProgress(progress: number): void {
    this.preloadProgress = progress;
    this.progressListeners.forEach((listener) => listener(progress));
  }

  getProgress(): number {
    return this.preloadProgress;
  }

  isInProgress(): boolean {
    return this.isPreloading;
  }
}

export const cachePreloader = CachePreloaderService.getInstance();
