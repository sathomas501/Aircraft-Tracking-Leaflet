// components/tracking/utils/performanceUtils.ts
import type { ExtendedAircraft } from '@/types/base';

/**
 * Process aircraft data in chunks to prevent UI lockups
 * @param aircraft Array of aircraft to process
 * @param processFunction Function to call for each aircraft
 * @param chunkSize Size of each processing chunk
 * @param delayBetweenChunks Delay in ms between processing chunks
 * @returns Promise that resolves when all processing is complete
 */
export const processAircraftInChunks = async (
  aircraft: ExtendedAircraft[],
  processFunction: (aircraft: ExtendedAircraft, index: number) => void,
  chunkSize = 10,
  delayBetweenChunks = 0
): Promise<void> => {
  // If no aircraft, return immediately
  if (!aircraft.length) return Promise.resolve();

  // Process in chunks
  const totalChunks = Math.ceil(aircraft.length / chunkSize);

  console.log(
    `[Performance] Processing ${aircraft.length} aircraft in ${totalChunks} chunks of ${chunkSize}`
  );

  // Use a recursive function to process each chunk
  const processChunk = async (startIndex: number): Promise<void> => {
    // Calculate end index for this chunk
    const endIndex = Math.min(startIndex + chunkSize, aircraft.length);

    // Process this chunk
    for (let i = startIndex; i < endIndex; i++) {
      processFunction(aircraft[i], i);
    }

    // If more chunks remain, schedule the next one
    if (endIndex < aircraft.length) {
      return new Promise<void>((resolve) => {
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            setTimeout(() => {
              processChunk(endIndex).then(resolve);
            }, delayBetweenChunks);
          });
        } else {
          // Fallback for SSR: just process next chunk without delay
          processChunk(endIndex).then(resolve);
        }
      });
    }

    // All chunks processed
    return Promise.resolve();
  };

  // Start processing from the first chunk
  return processChunk(0);
};

/**
 * Debounce a function call
 * @param func Function to debounce
 * @param wait Wait time in ms
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>): void => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

/**
 * Check if aircraft position has changed significantly
 * @param prevPos Previous position [lat, lng]
 * @param currentPos Current position [lat, lng]
 * @param threshold Minimum change to consider significant
 * @returns Boolean indicating if position changed significantly
 */
export const hasPositionChanged = (
  prevPos: [number, number] | undefined,
  currentPos: [number, number],
  threshold = 0.0001
): boolean => {
  if (!prevPos) return true;

  return (
    Math.abs(prevPos[0] - currentPos[0]) > threshold ||
    Math.abs(prevPos[1] - currentPos[1]) > threshold
  );
};
