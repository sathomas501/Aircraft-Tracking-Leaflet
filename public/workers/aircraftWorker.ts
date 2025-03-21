// public/workers/aircraftWorker.ts
// This file will be placed in the public directory for the browser to access

// Define message types
interface ProcessMessageData {
  type: 'process';
  aircraft: any[]; // Aircraft data to process
}

interface ProcessedMessageData {
  type: 'processed';
  aircraft: any[]; // Processed aircraft data
  processingTime: number;
}

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent<ProcessMessageData>) => {
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
    const response: ProcessedMessageData = {
      type: 'processed',
      aircraft: validAircraft,
      processingTime,
    };

    self.postMessage(response);
  }
});

// Let the main thread know the worker is ready
self.postMessage({ type: 'ready' });
