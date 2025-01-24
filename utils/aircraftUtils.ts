// /utils/aircraftUtils.ts
import type { OpenSkyState } from '@/types/api/opensky';
import type { Aircraft } from '@/types/base';

export function mapStateToAircraft(state: OpenSkyState): Aircraft {
    return {
        icao24: state.icao24,
        "N-NUMBER": "",
        manufacturer: "Unknown",
        model: "Unknown",
        altitude: state.baro_altitude ?? 0,
        latitude: state.latitude ?? 0,
        longitude: state.longitude ?? 0,
        velocity: state.velocity ?? 0,
        heading: state.true_track ?? 0,
        on_ground: state.on_ground ?? false,
        last_contact: state.last_contact ?? Date.now(),
        NAME: "Unknown",
        CITY: "Unknown",
        STATE: "Unknown",
        OWNER_TYPE: "Unknown",
        TYPE_AIRCRAFT: "Unknown",
        isTracked: false,
    };
}
