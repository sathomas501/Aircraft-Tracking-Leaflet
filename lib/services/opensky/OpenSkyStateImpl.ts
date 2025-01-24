import type { OpenSkyState } from '@/types/api/opensky/interfaces';

export class OpenSkyStateImpl implements OpenSkyState {
    icao24: string;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    heading?: number;
    velocity?: number;
    on_ground?: boolean;
    last_contact?: number;

    constructor(initialState: OpenSkyState) {
        this.icao24 = initialState.icao24;
        this.latitude = initialState.latitude ?? 0;
        this.longitude = initialState.longitude ?? 0;
        this.altitude = initialState.baro_altitude ?? 0;
        this.heading = initialState.true_track ?? 0;
        this.velocity = initialState.velocity ?? 0;
        this.on_ground = initialState.on_ground ?? false;
        this.last_contact = initialState.last_contact ?? Date.now();
    }

    getState(): OpenSkyState {
        return {
            icao24: this.icao24,
            latitude: this.latitude,
            longitude: this.longitude,
            altitude: this.altitude,
            heading: this.heading,
            velocity: this.velocity,
            on_ground: this.on_ground,
            last_contact: this.last_contact,
        };
    }
}
