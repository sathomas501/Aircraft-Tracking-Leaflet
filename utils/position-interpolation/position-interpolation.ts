// utils/position-interpolation.ts
import type { Aircraft, PositionData } from '@/types/base';
import type { Position } from '@/utils/position-interpolation';

class PositionInterpolator {
    private static instance: PositionInterpolator;
    private positions = new Map<string, Position[]>();
    private readonly maxHistoryLength = 5;
    private readonly maxPredictionTime = 30000; // 30 seconds

    private constructor() {}

    static getInstance(): PositionInterpolator {
        if (!PositionInterpolator.instance) {
            PositionInterpolator.instance = new PositionInterpolator();
        }
        return PositionInterpolator.instance;
    }

    updatePosition(aircraft: Aircraft) {
        const history = this.positions.get(aircraft.icao24) || [];

        history.push({
            latitude: aircraft.latitude,
            longitude: aircraft.longitude,
            altitude: aircraft.altitude,
            heading: aircraft.heading,
            velocity: aircraft.velocity,
            timestamp: Date.now()
        });

        // Keep only recent history
        while (history.length > this.maxHistoryLength) {
            history.shift();
        }

        this.positions.set(aircraft.icao24, history);
    }

    interpolatePosition(icao24: string, timestamp: number): Position | null {
        const history = this.positions.get(icao24);
        if (!history || history.length < 2) return null;

        const latest = history[history.length - 1];
        if (timestamp - latest.timestamp > this.maxPredictionTime) return null;

        if (timestamp > latest.timestamp) {
            return this.extrapolatePosition(latest, timestamp);
        }

        let before = latest;
        let after = latest;
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].timestamp <= timestamp) {
                before = history[i];
                after = history[i + 1];
                break;
            }
        }

        const fraction = (timestamp - before.timestamp) / (after.timestamp - before.timestamp);
        return {
            latitude: this.lerp(before.latitude, after.latitude, fraction),
            longitude: this.lerp(before.longitude, after.longitude, fraction),
            altitude: this.lerp(before.altitude, after.altitude, fraction),
            heading: this.interpolateHeading(before.heading, after.heading, fraction),
            velocity: this.lerp(before.velocity, after.velocity, fraction),
            timestamp
        };
    }

    private extrapolatePosition(position: Position, timestamp: number): Position {
        const dt = (timestamp - position.timestamp) / 1000;
        const distance = position.velocity * dt;

        const { latitude, longitude } = this.calculateNewPosition(
            position.latitude,
            position.longitude,
            position.heading,
            distance
        );

        return {
            latitude,
            longitude,
            altitude: position.altitude,
            heading: position.heading,
            velocity: position.velocity,
            timestamp
        };
    }

    private lerp(start: number, end: number, fraction: number): number {
        return start + (end - start) * fraction;
    }

    private interpolateHeading(start: number, end: number, fraction: number): number {
        let diff = end - start;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        let result = start + diff * fraction;
        if (result < 0) result += 360;
        if (result >= 360) result -= 360;
        return result;
    }

    private calculateNewPosition(lat: number, lon: number, heading: number, distance: number): Position {
        const R = 6371000;
        const d = distance / R;
        const bearing = heading * Math.PI / 180;

        const lat1 = lat * Math.PI / 180;
        const lon1 = lon * Math.PI / 180;

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d) +
            Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
        );

        const lon2 = lon1 + Math.atan2(
            Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );

        return {
            latitude: lat2 * 180 / Math.PI,
            longitude: lon2 * 180 / Math.PI,
            altitude: 0,
            heading: 0,
            velocity: 0,
            timestamp: 0
        };
    }

    clearHistory(icao24: string) {
        this.positions.delete(icao24);
    }

    cleanup() {
        const now = Date.now();
        this.positions.forEach((history, icao24) => {
            if (now - history[history.length - 1].timestamp > this.maxPredictionTime) {
                this.positions.delete(icao24);
            }
        });
    }
}

// Standalone utility function for simple interpolation
export function interpolatePositions(
    positions: Aircraft[] | PositionData[],
    deltaTime: number
): Aircraft[] {
    if (positions.length < 2) return positions as Aircraft[];

    return positions.map(position => {
        const {
            latitude = 0,
            longitude = 0,
            altitude = 0,
            velocity = 0,
            heading = 0,
            manufacturer = 'Unknown',
            model = 'Unknown'
        } = position as Aircraft;

        const interpolationFactor = deltaTime / 1000;

        return {
            ...position,
            manufacturer,
            model,
            latitude: latitude + (velocity * Math.cos(heading * Math.PI / 180) * interpolationFactor),
            longitude: longitude + (velocity * Math.sin(heading * Math.PI / 180) * interpolationFactor),
            altitude
        } as Aircraft;
    });
}

export const positionInterpolator = PositionInterpolator.getInstance();
