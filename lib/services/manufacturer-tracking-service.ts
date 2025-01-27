
import axios from 'axios';
import { chunk } from 'lodash';
import { extrapolatePosition, CachedAircraftData } from '../../utils/polling-utils';
// manufacturer-tracking-service.ts
import type { Aircraft } from '@/types/base';
import { PollingRateLimiter } from './rate-limiter';
import { errorHandler, ErrorType } from './error-handler';
import { openSkyAuth } from './opensky-auth';
import { unifiedCache } from './managers/unified-cache-system';
import { TrackingDatabaseManager } from '../db/trackingDatabaseManager';

interface TrackingData {
 aircraft: Aircraft[];
}

interface OpenSkyState {
 [index: number]: any;
}

type OpenSkyStateArray = [
 string,   // icao24
 string,   // callsign
 string,   // origin_country
 number,   // time_position
 number,   // last_contact
 number,   // longitude
 number,   // latitude
 number,   // altitude
 boolean,  // on_ground
 number,   // velocity
 number,   // heading
 number,   // vertical_rate
 any[],    // sensors
 number,   // geo_altitude
 string,   // squawk
 boolean,  // spi
 number    // position_source
];

interface TrackingState {
 activeManufacturer: string | null;
 icao24List: string[];
 isPolling: boolean;
 lastPollTime: number;
 rateLimitInfo: {
   remainingRequests: number;
   remainingDaily: number;
 };
}

class ManufacturerTrackingService {
 private state: TrackingState;
 private rateLimiter: PollingRateLimiter;
 private subscribers = new Set<(data: TrackingData) => void>();

 constructor() {
   this.state = {
     activeManufacturer: null,
     icao24List: [],
     isPolling: false,
     lastPollTime: 0,
     rateLimitInfo: {
       remainingRequests: 0,
       remainingDaily: 0
     }
   };

   this.rateLimiter = new PollingRateLimiter({
    requestsPerMinute: 30,  // Reduced from 60
    requestsPerDay: 1000,
    minPollingInterval: 45000,  // Increased from 5000
    maxPollingInterval: 120000   // Increased from 30000
  });
 }

 public subscribe(callback: (data: TrackingData) => void) {
   this.subscribers.add(callback);
   return {
     unsubscribe: () => this.subscribers.delete(callback)
   };
 }

 private notifySubscribers(data: TrackingData) {
   this.subscribers.forEach(callback => callback(data));
 }

 private async pollData(): Promise<void> {
   console.log('[Polling] Starting poll attempt');
   if (!await this.rateLimiter.tryAcquire()) {
     console.log('[Polling] Rate limit exceeded');
     return;
   }

   try {
     console.log('[Polling] Fetching data from OpenSky');
     if (!await openSkyAuth.ensureAuthenticated()) {
       throw new Error('Authentication failed');
     }

     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 5000);

     const response = await fetch(
       'https://opensky-network.org/api/states/all?lamin=24.396308&lomin=-125.000000&lamax=49.384358&lomax=-66.934570',
       {
         headers: openSkyAuth.getAuthHeaders(),
         signal: controller.signal
       }
     );

     clearTimeout(timeoutId);

     if (!response.ok) {
       throw new Error(`HTTP error! status: ${response.status}`);
     }

     const data = await response.json();

     if (data?.states) {
       console.log(`[Polling] Received ${data.states.length} total aircraft`);
       const activeAircraft = data.states
         .filter((state: OpenSkyStateArray) =>
           this.state.icao24List.includes(state[0]))
         .map((state: OpenSkyStateArray) => ({
           icao24: state[0],
           latitude: Number(state[6]),
           longitude: Number(state[5]),
           altitude: Number(state[7]),
           velocity: Number(state[9]),
           heading: Number(state[10]),
           on_ground: Boolean(state[8]),
           last_contact: state[4]
         }));

       if (activeAircraft.length > 0) {
         console.log('[Polling] Active aircraft details:',
           activeAircraft.map((aircraft: { icao24: string, latitude: number, longitude: number }) => ({
             icao24: aircraft.icao24,
             lat: aircraft.latitude,
             lon: aircraft.longitude
           }))
         );
         try {
           unifiedCache.set('activeAircraft', activeAircraft);
           await TrackingDatabaseManager.getInstance().upsertActiveAircraft(activeAircraft, data);
           this.notifySubscribers({ aircraft: activeAircraft });
         } catch (error) {
           this.rateLimiter.increasePollingInterval();
           errorHandler.handleError(
             ErrorType.POLLING,
             error instanceof Error ? error.message : 'Polling failed'
           );
         }
       }
     }
   } 
   
   catch (error) {
    if (error instanceof Error && error.message.includes('429')) {
      const backoffTime = this.rateLimiter.getCurrentPollingInterval() * 2;
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
    this.rateLimiter.increasePollingInterval();
    errorHandler.handleError(
      ErrorType.POLLING,
      error instanceof Error ? error.message : 'Polling failed'
    );
   }
 }

 private schedulePoll(): void {
   if (!this.state.isPolling) return;

   const interval = this.rateLimiter.getCurrentPollingInterval();
   setTimeout(() => {
     this.pollData().then(() => this.schedulePoll());
   }, interval);
 }

 public async startPolling(manufacturer: string, icao24List: string[]): Promise<void> {
   console.log(`[Polling] Starting for ${manufacturer} with ${icao24List.length} aircraft`);
   this.state.activeManufacturer = manufacturer;
   this.state.icao24List = icao24List;
   this.state.isPolling = true;
   await this.pollData();
   this.schedulePoll();
 }

 public stopPolling(): void {
   this.state.isPolling = false;
   this.state.activeManufacturer = null;
   this.state.icao24List = [];
   this.rateLimiter.resetPollingInterval();
 }

 public getTrackingStatus() {
   return {
     isTracking: this.state.isPolling,
     manufacturer: this.state.activeManufacturer,
     aircraftCount: this.state.icao24List.length,
     lastPollTime: this.state.lastPollTime,
     rateLimitInfo: this.state.rateLimitInfo
   };
 }
}

export const manufacturerTracking = new ManufacturerTrackingService();
async function fetchInitialLiveDataWithRateLimiter(icao24List: string[]): Promise<void> {
    const rateLimiter = new PollingRateLimiter({ requestsPerMinute: 60, requestsPerDay: 1440 }); // Assuming 60 requests per minute limit and 1440 requests per day
    const batchSize = 100; // Adjust batch size based on API capacity
    const batches = chunk(icao24List, batchSize);

    for (const batch of batches) {
        if (rateLimiter.canProceed()) {
            try {
                const response = await axios.get('https://opensky-network.org/api/states/all', {
                    params: { icao24: batch.join(',') },
                    headers: openSkyAuth.getAuthHeaders(),
                });

                // Update live cache and tracking database
                response.data.forEach(async (aircraft: any) => {
                  const liveData = {
                      icao24: aircraft.icao24,
                      latitude: aircraft.latitude,
                      longitude: aircraft.longitude,
                      altitude: aircraft.altitude || null, // Ensure altitude is included
                      velocity: aircraft.velocity,
                      heading: aircraft.heading,
                      last_contact: Date.now(), // Use `last_contact` to align with database fields
                      static_data: {
                          manufacturer: aircraft.manufacturer || null,
                          model: aircraft.model || null,
                      },
                  };
              
                  // Update cache
                  unifiedCache.set(aircraft.icao24, liveData);

                  const data = {
                    latitude: aircraft.latitude,
                    longitude: aircraft.longitude,
                    altitude: aircraft.altitude,
                    velocity: aircraft.velocity,
                    heading: aircraft.heading,
                    on_ground: aircraft.on_ground,
                };

              
                  // Store in tracking database
                  await TrackingDatabaseManager.getInstance().upsertActiveAircraft(aircraft.icao24, data);
              });
              
            } catch (error) {
                console.error(`[Error] Failed to fetch live data for batch: ${batch}`, error);
            }
        } else {
            console.warn('Rate limit exceeded. Waiting before proceeding to the next batch.');
            await new Promise(resolve => setTimeout(resolve, rateLimiter.getWaitTime()));
        }
    }
}

async function periodicPolling(icao24List: string[]): Promise<void> {
    const pollingInterval = 30000; // 30 seconds
    setInterval(async () => {
        const currentTime = Date.now();

        // Extrapolate positions from cached data
        const extrapolatedData = icao24List.map((icao24) => {
            const cachedData = unifiedCache.get(icao24);
            return cachedData ? extrapolatePosition(cachedData, currentTime) : null;
        }).filter((data) => data !== null);

        // Handle extrapolated data (e.g., for UI updates)
        handlePollingData(extrapolatedData);

        // Refresh live data for stale entries
        await fetchInitialLiveDataWithRateLimiter(icao24List);
    }, pollingInterval);
}

function handlePollingData(data: CachedAircraftData[]): void {
    console.log('[Polling] Handling data:', data);
}
