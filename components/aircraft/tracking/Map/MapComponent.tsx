import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { Aircraft } from '@/types/base';
import { MAP } from '@/constants/map';
import { AIRCRAFT } from '@/constants/aircraft';

interface MapComponentProps {
  aircraft: Aircraft[];
}

const MapComponent = ({ aircraft = [] }: MapComponentProps) => {
  useEffect(() => {
    console.log('MapComponent mounted');
    return () => {
      console.log('MapComponent unmounted');
    };
  }, []);

  console.log('Rendering map with', aircraft.length, 'aircraft');
  
  return (
    <MapContainer
      center={MAP.DEFAULT_CENTER}
      zoom={MAP.DEFAULT_ZOOM}
      {...MAP.OPTIONS}
      className="w-full h-full"
    >
      <TileLayer
  url={`${MAP.TILE_LAYER.URL}?v=${Date.now()}`}
  attribution={MAP.TILE_LAYER.ATTRIBUTION}
/>
      
      {aircraft.map((plane) => (
        <Marker
          key={plane.icao24}
          position={[plane.latitude, plane.longitude]}
          zIndexOffset={plane.on_ground ? AIRCRAFT.LAYERS.GROUNDED : AIRCRAFT.LAYERS.AIRBORNE}
          opacity={plane.on_ground ? AIRCRAFT.MARKERS.OPACITY.GROUNDED : AIRCRAFT.MARKERS.OPACITY.ACTIVE}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold">{plane.manufacturer}</h3>
              <p>Model: {plane.model}</p>
              <p>ICAO24: {plane.icao24}</p>
              <p className={plane.on_ground ? AIRCRAFT.STATUS.GROUNDED.COLOR : AIRCRAFT.STATUS.AIRBORNE.COLOR}>
                {plane.on_ground ? AIRCRAFT.STATUS.GROUNDED.LABEL : AIRCRAFT.STATUS.AIRBORNE.LABEL}
              </p>
              {!plane.on_ground && (
                <>
                  <p>Altitude: {Math.round(plane.altitude * AIRCRAFT.CONVERSIONS.METERS_TO_FEET)} ft</p>
                  <p>Speed: {Math.round(plane.velocity * AIRCRAFT.CONVERSIONS.MPS_TO_MPH)} mph</p>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default MapComponent;