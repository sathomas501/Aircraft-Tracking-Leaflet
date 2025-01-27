

export function extrapolatePosition(aircraft: any, currentTime: number): any {
    const timeDelta = (currentTime - aircraft.last_contact) / 1000; // Time difference in seconds
    const distance = aircraft.velocity * timeDelta; // Distance traveled

    // Calculate new latitude and longitude
    const newLatitude =
        aircraft.latitude + (distance / 111139) * Math.cos(aircraft.heading * (Math.PI / 180));
    const newLongitude =
        aircraft.longitude +
        (distance / (111139 * Math.cos(aircraft.latitude * (Math.PI / 180)))) *
        Math.sin(aircraft.heading * (Math.PI / 180));

    return {
        ...aircraft,
        latitude: newLatitude,
        longitude: newLongitude,
        last_contact: currentTime,
    };
}


