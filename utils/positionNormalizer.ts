import { PositionData as BasePositionData } from '@/types/base';
import { OpenSkyPositionData } from '@/types/opensky';

export function normalizePositions(
    positions: BasePositionData[]
): OpenSkyPositionData[] {
    return positions.map((position) => ({
        ...position,
        latitude: position.latitude ?? 0, // Ensure latitude is a number
        longitude: position.longitude ?? 0,
        altitude: position.altitude ?? 0,
        velocity: position.velocity ?? 0,
        heading: position.heading ?? 0,
    }));
}
