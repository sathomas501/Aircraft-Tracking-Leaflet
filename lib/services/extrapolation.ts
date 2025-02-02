import { Position } from './aircraftPositionService';

export interface ExtrapolatedPosition extends Position {
    isExtrapolated: boolean;
}

export function extrapolatePosition(
    aircraft: Position,
    currentTime: number,
    maxExtrapolationTime: number = 300000 // 5 minutes in milliseconds
): ExtrapolatedPosition | null {
    const timeDelta = (currentTime - aircraft.last_contact) / 1000; // Time difference in seconds
    
    // Don't extrapolate if the time difference is too large
    if (timeDelta * 1000 > maxExtrapolationTime) {
        return null;
    }

    // Don't extrapolate if aircraft is on ground or essential data is missing
    if (aircraft.on_ground || !aircraft.velocity || !aircraft.heading) {
        return {
            ...aircraft,
            isExtrapolated: false
        };
    }

    // Convert heading from degrees to radians
    const headingRad = aircraft.heading * (Math.PI / 180);
    
    // Calculate distance traveled (in meters)
    const distance = aircraft.velocity * 0.514444 * timeDelta; // Convert knots to m/s
    
    // Earth's radius in meters
    const R = 6371000;
    
    // Current position in radians
    const lat1 = aircraft.latitude * (Math.PI / 180);
    const lon1 = aircraft.longitude * (Math.PI / 180);
    
    // Calculate new position
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distance / R) +
        Math.cos(lat1) * Math.sin(distance / R) * Math.cos(headingRad)
    );
    
    const lon2 = lon1 + Math.atan2(
        Math.sin(headingRad) * Math.sin(distance / R) * Math.cos(lat1),
        Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    // Convert back to degrees
    const newLatitude = lat2 * (180 / Math.PI);
    const newLongitude = lon2 * (180 / Math.PI);

    // Keep altitude unchanged since we don't have vertical rate
    const newAltitude = aircraft.altitude;

    return {
        ...aircraft,
        latitude: newLatitude,
        longitude: newLongitude,
        altitude: newAltitude,
        last_contact: currentTime,
        isExtrapolated: true
    };
}

// Helper function to determine if a position needs updating
export function shouldUpdatePosition(
    currentPosition: Position,
    newPosition: Position,
    minUpdateDistance: number = 10, // minimum distance in meters
    minUpdateTime: number = 1000 // minimum time in milliseconds
): boolean {
    // Time-based update - use last_contact instead of timestamp
    if (newPosition.last_contact - currentPosition.last_contact > minUpdateTime) {
        return true;
    }

    // Distance-based update
    const R = 6371e3; // Earth's radius in meters
    const φ1 = currentPosition.latitude * Math.PI/180;
    const φ2 = newPosition.latitude * Math.PI/180;
    const Δφ = (newPosition.latitude - currentPosition.latitude) * Math.PI/180;
    const Δλ = (newPosition.longitude - currentPosition.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance > minUpdateDistance;
}