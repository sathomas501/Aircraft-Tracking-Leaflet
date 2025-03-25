// EnhancedContextAircraftMarker.tsx - Distance-based hover approach
import React, { useRef, useState, useEffect, memo } from 'react';
import { Marker, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import { useEnhancedMapContext } from '../../tracking/context/EnhancedMapContext';
import { createAircraftIcon } from '../map/AircraftIcon/AircraftIcon';
import type { ExtendedAircraft } from '@/types/base';
import L from 'leaflet';

interface EnhancedContextAircraftMarkerProps {
  aircraft: ExtendedAircraft;
}

// Calculate distance between two points in pixels on the map
const calculatePixelDistance = (
  map: L.Map,
  latlng1: L.LatLng,
  latlng2: L.LatLng
): number => {
  const point1 = map.latLngToContainerPoint(latlng1);
  const point2 = map.latLngToContainerPoint(latlng2);
  return point1.distanceTo(point2);
};

const HOVER_DISTANCE_THRESHOLD = 25; // pixels

const EnhancedContextAircraftMarker: React.FC<
  EnhancedContextAircraftMarkerProps
> = ({ aircraft }) => {
  const { selectedAircraft, selectAircraft, zoomLevel } =
    useEnhancedMapContext();
  const [isHovering, setIsHovering] = useState(false);
  const markerRef = useRef<L.Marker>(null);

  const isSelected = selectedAircraft?.icao24 === aircraft.icao24;

  // Skip rendering if no valid position
  if (!aircraft?.latitude || !aircraft?.longitude) return null;

  // Get aircraft icon
  const icon = createAircraftIcon(aircraft, {
    isSelected,
    zoomLevel: zoomLevel || 9,
  });

  // Format data for display
  const formattedAltitude = aircraft.altitude
    ? Math.round(aircraft.altitude).toLocaleString() + ' ft'
    : 'N/A';

  const formattedSpeed = aircraft.velocity
    ? Math.round(aircraft.velocity) + ' kts'
    : 'N/A';

  const registration =
    aircraft.registration || aircraft['N-NUMBER'] || aircraft.icao24;

  // Use mouse movement to detect hover based on distance to marker
  const MouseMoveHandler = () => {
    const map = useMapEvents({
      mousemove: (e) => {
        if (!markerRef.current) return;

        const markerLatLng = markerRef.current.getLatLng();
        const mouseLatLng = e.latlng;

        // Calculate distance between mouse and marker in pixels
        const distance = calculatePixelDistance(map, markerLatLng, mouseLatLng);

        // Update hover state based on distance threshold
        if (distance < HOVER_DISTANCE_THRESHOLD) {
          if (!isHovering) {
            console.log(
              `Mouse near aircraft ${aircraft.icao24}, distance: ${distance}px`
            );
            setIsHovering(true);
          }
        } else if (isHovering) {
          console.log(
            `Mouse away from aircraft ${aircraft.icao24}, distance: ${distance}px`
          );
          setIsHovering(false);
        }
      },
      mouseout: () => {
        // Clear hover state when mouse leaves the map
        if (isHovering) {
          setIsHovering(false);
        }
      },
      zoom: () => {
        // Recalculate on zoom
        if (isHovering) {
          setIsHovering(false);
        }
      },
      drag: () => {
        // Clear hover state when map is being dragged
        if (isHovering) {
          setIsHovering(false);
        }
      },
    });

    return null;
  };

  return (
    <>
      {/* Mouse move tracker component */}
      <MouseMoveHandler />

      {/* Marker for aircraft */}
      <Marker
        position={[aircraft.latitude, aircraft.longitude]}
        icon={icon || undefined}
        ref={markerRef}
        eventHandlers={{
          click: () => {
            console.log('Marker clicked');
            selectAircraft(aircraft);
          },
        }}
        zIndexOffset={isSelected ? 1000 : 0}
      >
        {/* Permanently visible tooltip when hovering */}
        {isHovering && (
          <Tooltip
            direction="top"
            offset={[0, -20]}
            permanent={true}
            className="aircraft-tooltip visible"
          >
            <div style={{ padding: '8px' }}>
              <div style={{ fontWeight: 'bold' }}>
                {aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  fontSize: '12px',
                  marginTop: '4px',
                }}
              >
                <div>Alt: {formattedAltitude}</div>
                <div>Speed: {formattedSpeed}</div>
                {aircraft.heading && (
                  <div style={{ gridColumn: 'span 2' }}>
                    Heading: {Math.round(aircraft.heading)}°
                  </div>
                )}
              </div>
            </div>
          </Tooltip>
        )}

        {/* Popup for when aircraft is selected */}
        {isSelected && (
          <Popup>
            <div style={{ padding: '10px', minWidth: '200px' }}>
              <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                {registration}
              </h3>
              <div>
                <div style={{ marginBottom: '4px' }}>
                  <b>Model:</b>{' '}
                  {aircraft.model || aircraft.TYPE_AIRCRAFT || 'Unknown'}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <b>Altitude:</b> {formattedAltitude}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  <b>Speed:</b> {formattedSpeed}
                </div>
                {aircraft.heading && (
                  <div style={{ marginBottom: '4px' }}>
                    <b>Heading:</b> {Math.round(aircraft.heading)}°
                  </div>
                )}
                <div style={{ marginBottom: '4px' }}>
                  <b>ICAO:</b> {aircraft.icao24}
                </div>
              </div>
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <button
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    window.open(`/aircraft/${aircraft.icao24}`, '_blank')
                  }
                >
                  View Details
                </button>
              </div>
            </div>
          </Popup>
        )}
      </Marker>
    </>
  );
};

export default memo(EnhancedContextAircraftMarker);
