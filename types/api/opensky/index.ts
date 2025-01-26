// types/api/opensky/index.ts
<<<<<<< HEAD
import { PositionData } from '@/types/base';
import { parsePositionData } from './utils';
=======
>>>>>>> 798df221367966fbfa340eee7bccf054863206c6
export * from './interfaces';
export * from './messages';
export * from './utils';

export function parseOpenSkyStateToPosition(state: unknown[]): PositionData | null {
  return parsePositionData(state);
}

export function parseOpenSkyStates(rawStates: unknown[][]): PositionData[] {
  if (!Array.isArray(rawStates)) return [];

  return rawStates
    .map(state => parseOpenSkyStateToPosition(state))
    .filter((pos): pos is PositionData => pos !== null);
}