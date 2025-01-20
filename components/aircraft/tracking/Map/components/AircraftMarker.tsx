// components/aircraft/tracking/Map/components/AircraftMarker.tsx
import React from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { AircraftDisplay } from '@/components/aircraft/AircraftDisplay';
import { getAircraftIcon, getIconSize } from '@/utils/aircraft-icons';
import type { Aircraft } from '@/types/base';
import styles from '@/styles/AircraftMarker.module.css';

interface AircraftMarkerProps {
    aircraft: Aircraft;
}

const getAircraftTypeLabel = (typeCode: string): string => {
    const types: Record<string, string> = {
        '1': 'Fixed Wing Single Engine',
        '2': 'Fixed Wing Multi Engine',
        '3': 'Jet',
        '4': 'Turbo Prop',
        '5': 'Amphibian',
        '6': 'Helicopter',
        '7': 'Glider',
        '8': 'Military',
        '9': 'Experimental'
    };
    return types[typeCode] || 'Unknown Type';
};

const getOwnerTypeLabel = (ownerCode: string): string => {
    const types: Record<string, string> = {
        '1': 'Private',
        '2': 'Corporate',
        '3': 'Commercial',
        '4': 'Dealer',
        '5': 'Government'
    };
    return types[ownerCode] || 'Unknown Owner';
};

const formatAltitude = (alt: number): string => 
    alt > 0 ? `${alt.toLocaleString()} ft` : 'Ground Level';

const formatSpeed = (velocity: number): string => 
    velocity > 0 ? `${Math.round(velocity)} kts` : 'Stationary';

export const AircraftMarker: React.FC<AircraftMarkerProps> = ({ aircraft }) => {
    if (!aircraft.latitude || !aircraft.longitude) {
        return null;
    }

    const iconUrl = getAircraftIcon(
        aircraft.TYPE_AIRCRAFT,
        aircraft.OWNER_TYPE,
        !aircraft.on_ground
    );
    
    const [width, height] = getIconSize(aircraft.TYPE_AIRCRAFT);

    // Prepare tooltip content
    const tooltipContent = `
        <div class="font-bold text-sm">${aircraft['N-NUMBER']}</div>
        <div class="text-xs">
            ${getAircraftTypeLabel(aircraft.TYPE_AIRCRAFT)} • 
            ${getOwnerTypeLabel(aircraft.OWNER_TYPE)}
        </div>
        <div class="text-xs mt-1">
            ${formatAltitude(aircraft.altitude)} • 
            ${formatSpeed(aircraft.velocity)}
        </div>
    `;

    const markerIcon = L.divIcon({
      className: `${styles['aircraft-marker']} ${aircraft.TYPE_AIRCRAFT === '6' ? styles.helicopter : ''}`,
      html: `
          <div class="${styles['aircraft-icon']}" 
               data-type="${aircraft.TYPE_AIRCRAFT}"
               data-owner="${aircraft.OWNER_TYPE}">
              <img 
                  src="${iconUrl}"
                  style="transform: rotate(${aircraft.heading || 0}deg);
                         ${aircraft.TYPE_AIRCRAFT === '6' ? 'animation: rotate 2s linear infinite;' : ''}"
                  alt="${getAircraftTypeLabel(aircraft.TYPE_AIRCRAFT)}"
                  width="${width}"
                  height="${height}"
              />
          </div>
      `,
      iconSize: [width, height],
      iconAnchor: [width/2, height/2],
  });

  return (
      <Marker
          key={aircraft.icao24}
          position={[aircraft.latitude, aircraft.longitude]}
          icon={markerIcon}
          zIndexOffset={getZIndexOffset(aircraft)}
      >
          <Tooltip 
              direction="top" 
              offset={[0, -height/2]} 
              opacity={1.0}
              permanent={false}
              className="aircraft-tooltip"
          >
              <div className={styles['tooltip-content']}>
                  {/* ... tooltip content ... */}
              </div>
          </Tooltip>

          <Popup>
              <div className="min-w-[200px]">
                  <AircraftDisplay aircraft={aircraft} displayMode="popup" />
              </div>
          </Popup>
      </Marker>
  );
};

function getZIndexOffset(aircraft: Aircraft): number {
    if (aircraft.OWNER_TYPE === '5') return 1000;    // Government aircraft
    if (aircraft.TYPE_AIRCRAFT === '6') return 900;  // Helicopters
    if (aircraft.TYPE_AIRCRAFT === '3') return 800;  // Jets
    return 0;
}