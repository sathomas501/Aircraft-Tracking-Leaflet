// components/tracking/utils/workerUtils.ts
import type { ExtendedAircraft } from '@/types/base';

// Type definition for worker responses
interface WorkerResponse {
  type: string;
  aircraft?: ExtendedAircraft[];
  processingTime?: number;
  error?: string;
}

/**
 * Utility class to work with Aircraft processing web worker
 */
export class AircraftWorkerUtil {
  private worker: Worker | null = null;
  private isWorkerReady = false;
  private readyPromise: Promise<void>;
  private readyResolver: (() => void) | null = null;

  constructor() {
    // Create promise that resolves when worker is ready
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolver = resolve;
    });

    // Try to initialize the worker
    this.initWorker();
  }

  /**
   * Initialize the web worker
   */
  private initWorker(): void {
    try {
      if (typeof window !== 'undefined' && window.Worker) {
        this.worker = new Worker('/workers/aircraftWorker.js');

        // Set up message handler
        this.worker.onmessage = (event) => {
          const data = event.data as WorkerResponse;

          if (data.type === 'ready') {
            this.isWorkerReady = true;
            if (this.readyResolver) {
              this.readyResolver();
              this.readyResolver = null;
            }
          }
        };

        // Set up error handler
        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          this.isWorkerReady = false;
        };
      } else {
        console.warn('Web Workers not supported in this environment');
      }
    } catch (error) {
      console.error('Failed to initialize worker:', error);
    }
  }

  /**
   * Check if the worker is available
   */
  isAvailable(): boolean {
    return !!this.worker && this.isWorkerReady;
  }

  /**
   * Wait until the worker is ready
   */
  async waitUntilReady(): Promise<void> {
    if (this.isWorkerReady) return Promise.resolve();
    return this.readyPromise;
  }

  /**
   * Process aircraft data using the worker
   * @param aircraft Aircraft data to process
   * @returns Promise that resolves with processed aircraft data
   */
  async processAircraft(aircraft: ExtendedAircraft[]): Promise<{
    aircraft: ExtendedAircraft[];
    processingTime: number;
  }> {
    // If worker not available, process on main thread
    if (!this.isAvailable()) {
      console.warn('Worker not available, processing on main thread');
      const startTime = performance.now();

      // Filter aircraft with valid coordinates
      const validAircraft = aircraft.filter(
        (plane) =>
          typeof plane.latitude === 'number' &&
          typeof plane.longitude === 'number' &&
          !isNaN(plane.latitude) &&
          !isNaN(plane.longitude)
      );

      const processingTime = performance.now() - startTime;

      return {
        aircraft: validAircraft,
        processingTime,
      };
    }

    // Wait for worker to be ready
    await this.waitUntilReady();

    // Process aircraft data using worker
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      // Set up one-time message handler for this request
      const messageHandler = (event: MessageEvent) => {
        const data = event.data as WorkerResponse;

        if (data.type === 'processed' && data.aircraft) {
          // Remove this handler once processed
          this.worker?.removeEventListener('message', messageHandler);

          resolve({
            aircraft: data.aircraft,
            processingTime: data.processingTime || 0,
          });
        } else if (data.type === 'error') {
          this.worker?.removeEventListener('message', messageHandler);
          reject(new Error(data.error || 'Unknown worker error'));
        }
      };

      // Listen for response
      this.worker.addEventListener('message', messageHandler);

      // Send data to worker
      this.worker.postMessage({
        type: 'process',
        aircraft,
      });
    });
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isWorkerReady = false;
    }
  }
}

// Create and export a singleton instance
export const aircraftWorker = new AircraftWorkerUtil();
