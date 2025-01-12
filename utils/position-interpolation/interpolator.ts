// utils/position-interpolation/interpolator.ts
import type { Aircraft } from '@/types/base';
import { type Position } from './types';

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
        // Handle wrapping around 360 degrees
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        let result = start + diff * fraction;
        if (result < 0) result += 360;
        if (result >= 360) result -= 360;
        return result;
    }

    private calculateNewPosition(lat: number, lon: number, heading: number, distance: number): Position {
        // Use Haversine formula to calculate new position
        const R = 6371000; // Earth's radius in meters
        const d = distance / R; // angular distance
        const bearing = heading * Math.PI / 180; // Convert heading to radians

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

    getHistoryLength(icao24: string): number {
        return this.positions.get(icao24)?.length || 0;
    }

    getAllPositions(): Map<string, Position[]> {
        return new Map(this.positions);
    }
}

export const positionInterpolator = PositionInterpolator.getInstance();