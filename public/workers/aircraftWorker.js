// public/workers/aircraftWorker.js

/**
 * Web Worker for aircraft data processing
 * This runs in a separate thread to prevent UI blocking
 */

// Send ready message
self.postMessage({ type: 'ready' });

// Process aircraft data
self.onmessage = function (event) {
  const data = event.data;

  // Start timing
  const startTime = performance.now();

  try {
    if (data.type === 'process') {
      // Process aircraft data
      const processed = processAircraftData(data.aircraft);

      // Calculate processing time
      const processingTime = performance.now() - startTime;

      // Send processed data back
      self.postMessage({
        type: 'processed',
        aircraft: processed,
        processingTime,
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message,
    });
  }
};

/**
 * Process aircraft data
 * @param {Array} aircraft Aircraft data to process
 * @returns {Array} Processed aircraft data
 */
function processAircraftData(aircraft) {
  if (!aircraft || !aircraft.length) {
    return [];
  }

  // Filter invalid aircraft
  const validAircraft = aircraft.filter(
    (plane) =>
      typeof plane.latitude === 'number' &&
      typeof plane.longitude === 'number' &&
      !isNaN(plane.latitude) &&
      !isNaN(plane.longitude)
  );

  // Optimize by removing unnecessary properties for rendering
  return validAircraft.map((plane) => {
    // Create a minimal version for rendering
    const minimalPlane = {
      ICAO24: plane.ICAO24,
      latitude: plane.latitude,
      longitude: plane.longitude,
      altitude: plane.altitude,
      velocity: plane.velocity,
      heading: plane.heading,
      MODEL: plane.MODEL || plane.TYPE_AIRCRAFT,
      MANUFACTURER: plane.MANUFACTURER,
      registration: plane.registration || plane['REGISTRATION'],
      on_ground: plane.on_ground,
    };

    // Only include these optional properties if they exist
    if (plane.owner) minimalPlane.owner = plane.owner;
    if (plane.CITY) minimalPlane.CITY = plane.CITY;
    if (plane.STATE) minimalPlane.STATE = plane.STATE;
    if (plane.TYPE_AIRCRAFT) minimalPlane.TYPE_AIRCRAFT = plane.TYPE_AIRCRAFT;
    if (plane['REGISTRATION'])
      minimalPlane['REGISTRATION'] = plane['REGISTRATION'];

    return minimalPlane;
  });
}

/**
 * Check if aircraft is in map bounds
 * @param {Object} aircraft Aircraft object
 * @param {Object} bounds Map bounds object
 * @returns {Boolean} True if aircraft is in bounds
 */
function isInBounds(aircraft, bounds) {
  return (
    aircraft.latitude >= bounds.south &&
    aircraft.latitude <= bounds.north &&
    aircraft.longitude >= bounds.west &&
    aircraft.longitude <= bounds.east
  );
}
