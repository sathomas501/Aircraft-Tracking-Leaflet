// utils/helpers.ts
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// utils/helpers.ts
export const convertToCommaSeparated = (icao24List: { icao24: string }[]): string => {
  return icao24List
      .filter(item => item.icao24) // Ensure `icao24` exists
      .map(item => item.icao24)    // Extract `icao24`
      .join(',');                  // Join into a string
};


  