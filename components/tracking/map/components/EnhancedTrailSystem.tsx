// components/tracking/map/components/EnhancedTrailSystem.tsx
import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useEnhancedMapContext } from '../../context/EnhancedMapContext';
import { useEnhancedUI } from '../../../tracking/context/EnhancedUIContext';
import openSkyTrackingService from '../../../../lib/services/openSkyTrackingService';

// Interface for a position point
interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
}

// Props for the trail component
interface EnhancedTrailSystemProps {
  maxTrailLength?: number; // Maximum number of positions to keep per aircraft
  fadeTime?: number; // Time in minutes before trail points fade out
  selectedOnly?: boolean; // Whether to show trails for selected aircraft only
}

const EnhancedTrailSystem: React.FC<EnhancedTrailSystemProps> = ({
  maxTrailLength = 100,
  fadeTime = 30, // 30 minutes
  selectedOnly = false,
}) => {
  const { selectedAircraft } = useEnhancedUI();
  const [trails, setTrails] = useState<Map<string, AircraftPosition[]>>(
    new Map()
  );

  // Setup subscription to trails data from the tracking service
  useEffect(() => {
    console.log('Setting up trail subscription...');

    // Enable trails in the tracking service
    if (!openSkyTrackingService.areTrailsEnabled()) {
      openSkyTrackingService.setTrailsEnabled(true);
      openSkyTrackingService.setMaxTrailLength(maxTrailLength);
    }

    // Subscribe to data updates from the tracking service
    const unsubscribe = openSkyTrackingService.subscribe((data) => {
      console.log('Received tracking update with trails data');
      if (data.trails) {
        setTrails(data.trails);
      }
    });

    // Force generate trails if none exist
    if (openSkyTrackingService.getAllTrails().size === 0) {
      console.log('No trails found, generating...');
      openSkyTrackingService.forceGenerateTrails();
    }

    return () => {
      // Cleanup subscription when component unmounts
      unsubscribe();
    };
  }, [maxTrailLength]);

  // Update maxTrailLength when props change
  useEffect(() => {
    openSkyTrackingService.setMaxTrailLength(maxTrailLength);
  }, [maxTrailLength]);

  // Function to get opacity based on timestamp
  const getOpacityForPoint = (timestamp: number) => {
    const now = Date.now();
    const ageInMs = now - timestamp;
    const maxAgeInMs = fadeTime * 60 * 1000;
    return Math.max(0.2, 1 - ageInMs / maxAgeInMs);
  };

  // Filter trails based on selectedOnly prop
  const filteredTrails = new Map(trails);

  if (selectedOnly && selectedAircraft?.icao24) {
    // If selectedOnly is true and we have a selected aircraft,
    // only keep the trail for that aircraft
    const selectedIcao = selectedAircraft.icao24.toLowerCase();

    // Clear all trails except for the selected aircraft
    filteredTrails.forEach((_, icao) => {
      if (icao !== selectedIcao) {
        filteredTrails.delete(icao);
      }
    });
  }

  // If no trails to display, return null
  if (filteredTrails.size === 0) {
    return null;
  }

  // Render the trails
  return (
    <>
      {Array.from(filteredTrails.entries()).map(([icao24, positions]) => {
        // Skip trails with less than 2 positions (need at least 2 to draw a line)
        if (positions.length < 2) return null;

        // Create an array of positions for Leaflet
        const linePositions = positions.map(
          (pos) => [pos.latitude, pos.longitude] as [number, number]
        );

        // Create a gradient trail with segments based on timestamp
        return positions.slice(1).map((position, i) => {
          const prevPosition = [
            positions[i].latitude,
            positions[i].longitude,
          ] as [number, number];
          const currentPosition = [position.latitude, position.longitude] as [
            number,
            number,
          ];
          const opacity = getOpacityForPoint(position.timestamp);

          // Generate a color based on icao24
          const hash = icao24
            .split('')
            .reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const hue = hash % 360;
          const color = `hsla(${hue}, 70%, 50%, ${opacity})`;

          return (
            <Polyline
              key={`${icao24}-${i}`}
              positions={[prevPosition, currentPosition]}
              pathOptions={{
                color,
                weight: 2,
                opacity: 1,
                // Using as any to bypass the type restriction since smoothFactor is valid in Leaflet
                ...({ smoothFactor: 1 } as any),
              }}
            />
          );
        });
      })}
    </>
  );
};

export default EnhancedTrailSystem;
