// Define and export the CachedAircraftData type
export interface CachedAircraftData {
    icao24: string;
    latitude: number;
    longitude: number;
    velocity: number; // Speed in meters per second
    heading: number;  // Heading in degrees
    lastUpdate: number; // Timestamp in milliseconds
}

// Export the handlePollingData function
export function handlePollingData(data: CachedAircraftData[]): void {
    console.log('[Polling] Handling data:', data);
}

// Export the extrapolatePosition function
export function extrapolatePosition(aircraft: CachedAircraftData, currentTime: number): CachedAircraftData {
    const timeDelta = (currentTime - aircraft.lastUpdate) / 1000; // Time delta in seconds
    const distance = aircraft.velocity * timeDelta; // Distance traveled

    const newLatitude = aircraft.latitude + (distance / 111139) * Math.cos(aircraft.heading * (Math.PI / 180));
    const newLongitude = aircraft.longitude + (distance / (111139 * Math.cos(aircraft.latitude * (Math.PI / 180)))) * Math.sin(aircraft.heading * (Math.PI / 180));

    return {
        ...aircraft,
        latitude: newLatitude,
        longitude: newLongitude,
        lastUpdate: currentTime,
    };
}
