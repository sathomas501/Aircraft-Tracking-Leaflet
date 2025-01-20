// utils/aircraft-icons.ts
export const AIRCRAFT_TYPE_ICONS = {
    '6': '/helicopter-pin.png',     // Helicopter
    '1': '/fixed-wing-pin.png',     // Fixed Wing Single Engine
    '2': '/twin-engine-pin.png',    // Fixed Wing Multi Engine
    '3': '/jet-pin.png',            // Jet
    '4': '/turbo-prop-pin.png',     // Turboprop
    '5': '/amphibian-pin.png',      // Amphibian
} as const;

export const OWNER_TYPE_ICONS = {
    '5': '/government-pin.png',     // Government
    '1': '/private-pin.png',        // Private
    '2': '/corporate-pin.png',      // Corporate
    '3': '/commercial-pin.png',     // Commercial
} as const;

export function getAircraftIcon(typeCode: string, ownerType: string, isAirborne: boolean): string {
    // First check for special owner types (like government)
    if (ownerType === '5') {
        return OWNER_TYPE_ICONS['5'];
    }

    // Then check for specific aircraft types
    if (typeCode in AIRCRAFT_TYPE_ICONS) {
        const baseIcon = AIRCRAFT_TYPE_ICONS[typeCode as keyof typeof AIRCRAFT_TYPE_ICONS];
        // You could have different versions for airborne/ground
        return `${baseIcon}${isAirborne ? '-airborne' : ''}`;
    }

    // Default fallback icons
    return isAirborne ? '/aircraft-pin-blue.png' : '/aircraft-pin.png';
}

export function getIconSize(typeCode: string): [number, number] {
    // Different sizes for different aircraft types
    switch(typeCode) {
        case '6': // Helicopter
            return [28, 28];
        case '3': // Jet
            return [32, 32];
        default:
            return [24, 24];
    }
}