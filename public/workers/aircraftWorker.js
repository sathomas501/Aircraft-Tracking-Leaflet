// public/workers/aircraftWorker.js
// This file must be regular JavaScript as it's loaded directly by the browser

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  const { type, aircraft } = event.data;

  if (type === 'process') {
    const startTime = performance.now();

    // Filter aircraft with valid coordinates
    const validAircraft = aircraft.filter(
      (plane) =>
        typeof plane.latitude === 'number' &&
        typeof plane.longitude === 'number' &&
        !isNaN(plane.latitude) &&
        !isNaN(plane.longitude)
    );

    // Add any additional processing here
    // For example, sorting, grouping, or calculating additional properties

    const processingTime = performance.now() - startTime;

    // Send processed data back to the main thread
    const response = {
      type: 'processed',
      aircraft: validAircraft,
      processingTime,
    };

    self.postMessage(response);
  }
});

// Let the main thread know the worker is ready
self.postMessage({ type: 'ready' });
