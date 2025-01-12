// lib/services/cache-preloader.ts
import { aircraftCache } from './aircraft-cache';
import { errorHandler, ErrorType } from './error-handler';

interface PreloadConfig {
    regions?: {
        lamin: number;
        lomin: number;
        lamax: number;
        lomax: number;
        description: string;
    }[];
    manufacturers?: string[];
    maxAircraftPerRegion?: number;
}

class CachePreloaderService {
    private static instance: CachePreloaderService;
    private isPreloading: boolean = false;
    private preloadProgress: number = 0;
    private progressListeners: Set<(progress: number) => void> = new Set();

    private defaultConfig: PreloadConfig = {
        regions: [{
            // Continental US
            lamin: 24.396308,
            lomin: -125.000000,
            lamax: 49.384358,
            lomax: -66.934570,
            description: 'Continental US'
        }],
        maxAircraftPerRegion: 500
    };

    private constructor() {}

    static getInstance(): CachePreloaderService {
        if (!CachePreloaderService.instance) {
            CachePreloaderService.instance = new CachePreloaderService();
        }
        return CachePreloaderService.instance;
    }

    async preloadCache(config: PreloadConfig = this.defaultConfig): Promise<void> {
        if (this.isPreloading) {
            throw new Error('Preload already in progress');
        }

        this.isPreloading = true;
        this.preloadProgress = 0;
        this.updateProgress(0);

        try {
            // Preload each region
            const regions = config.regions || this.defaultConfig.regions || [];
            const totalRegions = regions.length;

            for (let i = 0; i < regions.length; i++) {
                const region = regions[i];
                try {
                    await this.preloadRegion(region, config.maxAircraftPerRegion);
                    this.updateProgress((i + 1) / totalRegions * 100);
                } catch (error) {
                    errorHandler.handleError(error, {
                        type: ErrorType.DATA_ERROR,
                        message: `Failed to preload region: ${region.description}`
                    });
                }

                // Wait between regions to respect rate limits
                if (i < regions.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }

            // If manufacturers are specified, preload manufacturer-specific data
            if (config.manufacturers?.length) {
                await this.preloadManufacturers(config.manufacturers);
            }

        } finally {
            this.isPreloading = false;
            this.updateProgress(100);
        }
    }

    private async preloadRegion(region: PreloadConfig['regions'][0], maxAircraft: number = 500): Promise<void> {
        const response = await fetch('/api/opensky', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                region,
                maxAircraft
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to preload region: ${response.statusText}`);
        }

        const data = await response.json();
        // Allow the cache service to handle the data
        aircraftCache.updateFromRest(region.description, data);
    }

    private async preloadManufacturers(manufacturers: string[]): Promise<void> {
        for (const manufacturer of manufacturers) {
            try {
                const response = await fetch(`/api/aircraft/icao24s?manufacturer=${manufacturer}`);
                if (!response.ok) continue;

                const { icao24List } = await response.json();
                if (icao24List?.length) {
                    // Preload positions for these aircraft
                    const positions = await fetch(`/api/opensky?icao24s=${icao24List.join(',')}`);
                    if (positions.ok) {
                        const data = await positions.json();
                        aircraftCache.updateFromRest(manufacturer, data);
                    }
                }
            } catch (error) {
                errorHandler.handleError(error, {
                    type: ErrorType.DATA_ERROR,
                    message: `Failed to preload manufacturer: ${manufacturer}`
                });
            }

            // Respect rate limits between manufacturers
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }

    onProgress(listener: (progress: number) => void) {
        this.progressListeners.add(listener);
        return () => this.progressListeners.delete(listener);
    }

    private updateProgress(progress: number) {
        this.preloadProgress = progress;
        this.progressListeners.forEach(listener => listener(progress));
    }

    getProgress(): number {
        return this.preloadProgress;
    }

    isInProgress(): boolean {
        return this.isPreloading;
    }
}

export const cachePreloader = CachePreloaderService.getInstance();