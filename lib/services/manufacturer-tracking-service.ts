import { PollingRateLimiter } from './rate-limiter';
import { errorHandler, ErrorType } from './error-handler';
import type { Aircraft } from '@/types/base';
import  UnifiedCacheService  from './managers/unified-cache-system';

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
    staticData: Map<string, Partial<Aircraft>>; // Add static data cache
}

// Define type for OpenSky state array
type OpenSkyState = [
    string,      // icao24
    string|null, // callsign
    string|null, // origin_country
    number|null, // time_position
    number|null, // last_contact
    number|null, // longitude
    number|null, // latitude
    number|null, // baro_altitude
    boolean|null, // on_ground
    number|null, // velocity
    number|null, // true_track
    number|null, // vertical_rate
    number|null, // sensors
    number|null, // geo_altitude
    string|null  // squawk
];

class ManufacturerTrackingService {
    private static instance: ManufacturerTrackingService;
    private state: TrackingState;
    private rateLimiter: PollingRateLimiter;
    private subscribers = new Set<(data: TrackingData) => void>();
    private readonly TIMEOUT = 10000;

    private constructor() {
        this.state = {
            icao24List: [],
            isPolling: false,
            rateLimitInfo: {
                remainingRequests: 0,
                remainingDaily: 0,
            },
            aircraftData: [],
            staticData: new Map() // Initialize static data cache
        };

        this.rateLimiter = new PollingRateLimiter({
            requireAuthentication: true,
            minPollingInterval: 5000,
            maxPollingInterval: 30000,
            maxWaitTime: 15000,
            retryLimit: 3,
            requestsPerMinute: 6000,    // 600 requests per rolling window of 10 minutes
            requestsPerDay: 4000        // Per user basis
        });
    }

    public static getInstance(): ManufacturerTrackingService {
        if (!ManufacturerTrackingService.instance) {
            ManufacturerTrackingService.instance = new ManufacturerTrackingService();
        }
        return ManufacturerTrackingService.instance;
    }

    private notifySubscribers(data: TrackingData): void {
        console.log('[Polling Update] Notifying subscribers with updated aircraft data:', data);
        this.subscribers.forEach(callback => callback(data));
    }
    
    private async fetchStaticData(icao24List: { icao24: string }[]): Promise<void> {
        try {
            const response = await fetch('/api/aircraft/static-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    icao24s: icao24List.map(item => item.icao24) 
                })
            });
    
            if (!response.ok) throw new Error('Failed to fetch static data');
            
            const staticData = await response.json();
            
            // Store in state
            this.state.staticData = new Map(
                staticData.map((aircraft: Aircraft) => [
                    aircraft.icao24,
                    {
                        "N-NUMBER": aircraft["N-NUMBER"],
                        manufacturer: aircraft.manufacturer,
                        model: aircraft.model,
                        NAME: aircraft.NAME,
                        CITY: aircraft.CITY,
                        STATE: aircraft.STATE,
                        TYPE_AIRCRAFT: aircraft.TYPE_AIRCRAFT,
                        OWNER_TYPE: aircraft.OWNER_TYPE
                    }
                ])
            );
        } catch (error) {
            console.error('[ManufacturerTracking] Error fetching static data:', error);
        }
    }    
    
    private async pollData(): Promise<void> {
        if (this.rateLimiter.isRateLimited()) {
            errorHandler.handleError(
                ErrorType.OPENSKY_RATE_LIMIT,
                'Polling rate limit exceeded',
                { nextAvailable: await this.rateLimiter.getNextAvailableSlot() }
            );
            return;
        }
    
        this.rateLimiter.recordRequest();
    
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);
    
            const icao24List = this.state.icao24List
                .map(item => item.icao24.toLowerCase().trim())
                .filter(icao => icao.length > 0);
    
            if (icao24List.length === 0) {
                errorHandler.handleError(
                    ErrorType.OPENSKY_INVALID_ICAO,
                    'No valid ICAO24 codes to track'
                );
                return;
            }
    
            const queryParams = new URLSearchParams({
                icao24: icao24List.join(',')
            });
    
            const response = await fetch(`/api/proxy/opensky?${queryParams}`, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
    
            clearTimeout(timeoutId);
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
    
            const data = await response.json();
    
            if (!data.states || !Array.isArray(data.states)) {
                errorHandler.handleError(
                    ErrorType.OPENSKY_DATA,
                    'No state data received from OpenSky'
                );
                this.notifySubscribers({ aircraft: [] });
                return;
            }
    
            const aircraft = data.states
                .filter((state: OpenSkyState) => state && Array.isArray(state) && state.length >= 12)
                .map((state: OpenSkyState) => {
                    const icao24 = state[0];
                    const staticInfo = this.state.staticData.get(icao24) || {};
    
                    return {
                        ...staticInfo,
                        icao24,
                        callsign: state[1],
                        originCountry: state[2],
                        longitude: state[5],
                        latitude: state[6],
                        altitude: state[7],
                        velocity: state[9],
                        heading: state[10],
                        verticalRate: state[11],
                        timestamp: state[3],
                        updated_at: Date.now()  // ✅ Ensure fresh timestamp for every poll
                    };
                });
    
            // ✅ Update internal state
            this.state.aircraftData = aircraft;
    
            // ✅ Update Cache
            const cacheService = UnifiedCacheService.getInstance();
            cacheService.setLiveData('manufacturer', aircraft); // Replace 'manufacturer' as needed
    
            // ✅ Notify Subscribers
            this.notifySubscribers({ aircraft });
    
            this.rateLimiter.decreasePollingInterval();
    
        } catch (error) {
            this.handlePollingError(error);
        }
    }
    

    private handlePollingError(error: unknown): void {
        console.error('[ManufacturerTracking] Polling error:', error);
        this.rateLimiter.increasePollingInterval();

        if (error instanceof Error) {
            if (error.message.includes('rate limit')) {
                errorHandler.handleError(
                    ErrorType.OPENSKY_RATE_LIMIT,
                    error.message
                );
            } else if (error.message.includes('authentication')) {
                errorHandler.handleError(
                    ErrorType.OPENSKY_AUTH,
                    error.message
                );
            } else if (error.message.includes('timeout')) {
                errorHandler.handleError(
                    ErrorType.OPENSKY_TIMEOUT,
                    error.message
                );
            } else {
                errorHandler.handleError(
                    ErrorType.OPENSKY_SERVICE,
                    error.message
                );
            }
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
            errorHandler.handleError(
                ErrorType.OPENSKY_INVALID_ICAO,
                'Empty ICAO24 list provided'
            );
            throw new Error('Invalid ICAO24 list');
        }
    
        console.log('[ManufacturerTracking] Starting polling with:', {
            icao24Count: icao24List.length,
            sample: icao24List.slice(0, 5)
        });
    
        this.state.icao24List = icao24List;
        
        // Fetch static data before starting polling
        await this.fetchStaticData(icao24List);
        
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

export const manufacturerTracking = ManufacturerTrackingService.getInstance();