// lib/utils/position-interpolation.ts
import type { Aircraft } from '@/types/base';

interface Position {
    latitude: number;
    longitude: number;
    altitude: number;
    heading: number;
    velocity: number;
    timestamp: number;
}

class PositionInterpolator {
    private static instance: PositionInterpolator;
    private positions: Map<string, Position[]> = new Map();
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

        // Find surrounding positions
        const latest = history[history.length - 1];
        if (timestamp - latest.timestamp > this.maxPredictionTime) return null;

        // If timestamp is beyond latest, extrapolate
        if (timestamp > latest.timestamp) {
            return this.extrapolatePosition(latest, timestamp);
        }

        // Find positions surrounding the requested timestamp
        let before = latest;
        let after = latest;
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].timestamp <= timestamp) {
                before = history[i];
                after = history[i + 1];
                break;
            }
        }

        // Interpolate between positions
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
        const dt = (timestamp - position.timestamp) / 1000; // seconds
        const distance = position.velocity * dt; // meters

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
        const R = 6371000; // Earth's radius in meters
        const d = distance / R; // angular distance
        const heading_rad = heading * Math.PI / 180;
        const lat_rad = lat * Math.PI / 180;
        const lon_rad = lon * Math.PI / 180;

        const new_lat_rad = Math.asin(
            Math.sin(lat_rad) * Math.cos(d) +
            Math.cos(lat_rad) * Math.sin(d) * Math.cos(heading_rad)
        );

        const new_lon_rad = lon_rad + Math.atan2(
            Math.sin(heading_rad) * Math.sin(d) * Math.cos(lat_rad),
            Math.cos(d) - Math.sin(lat_rad) * Math.sin(new_lat_rad)
        );

        return {
            latitude: new_lat_rad * 180 / Math.PI,
            longitude: new_lon_rad * 180 / Math.PI,
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

export const positionInterpolator = PositionInterpolator.getInstance();