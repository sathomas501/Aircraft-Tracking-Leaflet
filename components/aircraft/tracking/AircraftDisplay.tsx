// components/aircraft/AircraftDisplay.tsx
import React, { useCallback } from 'react';
import { Aircraft } from '@/types/base';
import { Popup } from 'react-leaflet';

interface AircraftDisplayProps {
    aircraft: Aircraft | Aircraft[];
    selectedAircraft?: Aircraft;
    onSelect?: (aircraft: Aircraft) => void;
    displayMode: 'list' | 'popup';
    onManufacturerChange?: (manufacturer: string) => void;
}

export const AircraftDisplay: React.FC<AircraftDisplayProps> = ({
    aircraft,
    selectedAircraft,
    onSelect,
    displayMode,
    onManufacturerChange,
}) => {
    const formatValue = (value: string | number | undefined) =>
        value !== undefined && value !== '' ? value : 'N/A';

    const renderAircraftInfo = (plane: Aircraft, compact = true) => (
        <div className="text-sm space-y-2">
            {/* Registration and Aircraft Section */}
            <div className="font-semibold border-b pb-1">
                <div className="text-blue-600">{formatValue(plane['N-NUMBER'])}</div>
                <div>{formatValue(plane.manufacturer)} {formatValue(plane.model)}</div>
            </div>

            {/* Operator Section */}
            <div className="space-y-1">
                {plane.NAME && <div className="font-medium">{formatValue(plane.NAME)}</div>}
                {plane.operator && (
                    <div className="text-gray-600">
                        Operator: {formatValue(plane.operator)}
                    </div>
                )}
                {(plane.CITY || plane.STATE) && (
                    <div className="text-gray-600">
                        Based: {formatValue(plane.CITY)}, {formatValue(plane.STATE)}
                    </div>
                )}
            </div>

            {/* Flight Data Section */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t pt-1">
                <div className="text-gray-600">Altitude:</div>
                <div>{plane.altitude ? `${plane.altitude.toLocaleString()} ft` : 'N/A'}</div>
                
                <div className="text-gray-600">Speed:</div>
                <div>{plane.velocity ? `${Math.round(plane.velocity)} knots` : 'N/A'}</div>
                
                <div className="text-gray-600">Heading:</div>
                <div>{plane.heading ? `${Math.round(plane.heading)}°` : 'N/A'}</div>
                
                <div className="text-gray-600">Status:</div>
                <div>{plane.on_ground ? 'On Ground' : 'Airborne'}</div>
            </div>

            {/* Type Information - Only show if available */}
            {(plane.TYPE_AIRCRAFT || plane.OWNER_TYPE) && (
                <div className="text-xs text-gray-500 border-t pt-1">
                    {plane.TYPE_AIRCRAFT && (
                        <div>Type: {formatValue(plane.TYPE_AIRCRAFT)}</div>
                    )}
                    {plane.OWNER_TYPE && (
                        <div>Owner: {formatValue(plane.OWNER_TYPE)}</div>
                    )}
                </div>
            )}
        </div>
    );

    const handleManufacturerSelect = useCallback((manufacturer: string) => {
        onManufacturerChange?.(manufacturer);
    }, [onManufacturerChange]);

    if (displayMode === 'popup' && aircraft instanceof Object) {
        return (
            <div className="min-w-[250px] max-w-[300px] p-2">
                {renderAircraftInfo(aircraft as Aircraft)}
            </div>
        );
    }

    if (displayMode === 'list' && Array.isArray(aircraft)) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aircraft.map((plane) => (
                    <div
                        key={plane.icao24}
                        className={`p-4 border rounded-lg cursor-pointer ${
                            selectedAircraft?.icao24 === plane.icao24
                                ? 'bg-blue-50 border-blue-500'
                                : 'hover:bg-gray-50'
                        }`}
                        onClick={() => onSelect?.(plane)}
                    >
                        {renderAircraftInfo(plane)}
                    </div>
                ))}
            </div>
        );
    }

    return null;
};