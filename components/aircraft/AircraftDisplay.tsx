// components/aircraft/AircraftDisplay.tsx
import React, { useCallback } from 'react';
import { Aircraft } from '@/types/types';
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
   <div className="text-sm">
     {(plane.manufacturer || plane.model) && (
       <div className="font-semibold">
         {formatValue(plane['N-NUMBER'])}
         <br />
         {formatValue(plane.manufacturer)} {formatValue(plane.model)}
       </div>
     )}
     {plane.NAME && <div>{formatValue(plane.NAME)}</div>}
     {plane.operator && <div>Operator: {formatValue(plane.operator)}</div>}
     {(plane.CITY || plane.STATE) && (
       <div>{formatValue(plane.CITY)}, {formatValue(plane.STATE)}</div>
     )}
     {plane.altitude && <div>Altitude: {formatValue(plane.altitude)} ft</div>}
     {plane.velocity && <div>Velocity: {formatValue(plane.velocity)} knots</div>}
   </div>
 );

 const handleManufacturerSelect = useCallback((manufacturer: string) => {
   onManufacturerChange?.(manufacturer);
 }, [onManufacturerChange]);

 if (displayMode === 'popup' && aircraft instanceof Object) {
   return (
     <Popup>
       <div className="min-w-[220px] max-w-[250px]">
         {renderAircraftInfo(aircraft as Aircraft)}
       </div>
     </Popup>
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

export default AircraftDisplay;
