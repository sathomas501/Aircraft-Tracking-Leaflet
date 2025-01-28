import { PollingRateLimiter } from './rate-limiter';
import { errorHandler, ErrorType } from './error-handler';
import { openSkyAuth } from './opensky-auth';
import type { Aircraft } from '@/types/base';

interface TrackingData {
    aircraft: Aircraft[];
}

interface TrackingState {
  icao24List: { icao24: string }[];
  isPolling: boolean;
  rateLimitInfo: {
    remainingRequests: number;
    remainingDaily: number;
  };
  aircraftData: Aircraft[];
}

class ManufacturerTrackingService {
  private state: TrackingState;
  private rateLimiter: PollingRateLimiter;
  private subscribers = new Set<(data: TrackingData) => void>();

  constructor() {
    this.state = {
      icao24List: [],
      isPolling: false,
      rateLimitInfo: {
        remainingRequests: 0,
        remainingDaily: 0,
      },
      aircraftData: []
    };

    this.rateLimiter = new PollingRateLimiter({
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      minPollingInterval: 5000,
      maxPollingInterval: 30000,
    });
  }

  private notifySubscribers(data: TrackingData): void {
    this.subscribers.forEach(callback => callback(data));
  }

  private async pollData(): Promise<void> {
    if (!await this.rateLimiter.tryAcquire()) {
        errorHandler.handleError(ErrorType.POLLING, 'Rate limit exceeded');
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Get list of ICAO24s
        const icao24List = this.state.icao24List.map(item => item.icao24.toLowerCase());

        console.log('[Debug] Fetching states via proxy:', {
            icao24Count: icao24List.length,
            sampleIcao24s: icao24List.slice(0, 5)
        });

        // Use our proxy endpoint instead of direct OpenSky API call
        const response = await fetch('/api/proxy/opensky', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ icao24List }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[OpenSky Proxy] Response:', {
            status: response.status,
            hasData: !!data,
            statesCount: data?.states?.length,
            sampleState: data?.states?.[0]
        });

        this.notifySubscribers({ aircraft: data.states || [] });
    } catch (error) {
        console.error('[Error] OpenSky proxy request failed:', error);
        this.rateLimiter.increasePollingInterval();
        errorHandler.handleError(
            ErrorType.POLLING,
            error instanceof Error ? error.message : 'Polling failed'
        );
    }
}

  public subscribe(callback: (data: TrackingData) => void): { unsubscribe: () => void } {
    this.subscribers.add(callback);
    return {
      unsubscribe: () => this.subscribers.delete(callback),
    };
  }

  public async startPolling(icao24List: { icao24: string }[]): Promise<void> {
    if (!icao24List || icao24List.length === 0) {
      throw new Error('Invalid ICAO24 list');
    }

    console.log('[Debug] Starting polling with:', {
        icao24Count: icao24List.length,
        sample: icao24List.slice(0, 5)
    });

    this.state.icao24List = icao24List;
    this.state.isPolling = true;

    await this.pollData();
    this.schedulePoll();
  }

  private schedulePoll(): void {
    if (!this.state.isPolling) return;

    const interval = this.rateLimiter.getCurrentPollingInterval();
    setTimeout(() => {
      this.pollData().then(() => this.schedulePoll());
    }, interval);
  }

  public stopPolling(): void {
    this.state.isPolling = false;
    this.state.icao24List = [];
    this.rateLimiter.resetPollingInterval();
  }
}

export const manufacturerTracking = new ManufacturerTrackingService();