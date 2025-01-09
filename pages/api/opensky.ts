// lib/api/opensky.ts
import axios from 'axios';
import NodeCache from 'node-cache';
import type { PositionData, OpenSkyResponse } from '@/types/api/opensky';

export class OpenSkyApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'OpenSkyApiError';
  }
}

class OpenSkyService {
  private cache: NodeCache;
  private readonly cacheTime = 15; // 15 seconds TTL
  private readonly restUrl = 'https://opensky-network.org/api/states/all';

  constructor(
    private readonly username?: string,
    private readonly password?: string
  ) {
    this.cache = new NodeCache({ stdTTL: this.cacheTime });
  }

  public async getPositions(icao24s?: string[]): Promise<PositionData[]> {
    try {
      // Try cache first
      const cachedData = this.cache.get<PositionData[]>('positions');
      if (cachedData) {
        return icao24s 
          ? cachedData.filter(pos => icao24s.includes(pos.icao24))
          : cachedData;
      }

      // Fetch from API if cache miss
      const response = await axios.get<OpenSkyResponse>(
        this.restUrl,
        {
          params: icao24s?.length ? { icao24: icao24s.join(',') } : undefined,
          auth: this.username && this.password 
            ? { username: this.username, password: this.password }
            : undefined,
          timeout: 5000
        }
      );

      if (!response.data?.states) {
        throw new OpenSkyApiError('No aircraft state data received');
      }

      const positions = this.parsePositions(response.data);
      this.cache.set('positions', positions);
      return positions;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new OpenSkyApiError(
          error.response?.data?.message || 'Failed to fetch aircraft positions',
          error.response?.status
        );
      }
      throw new OpenSkyApiError('Failed to fetch positions');
    }
  }

  private parsePositions(data: OpenSkyResponse): PositionData[] {
    return data.states.reduce<PositionData[]>((acc, state) => {
      const [
        icao24, _, __, ___, last_contact,
        longitude, latitude, altitude,
        on_ground, velocity, heading
      ] = state;

      if (typeof latitude === 'number' && typeof longitude === 'number') {
        acc.push({
          icao24,
          latitude,
          longitude,
          altitude: typeof altitude === 'number' ? altitude : undefined,
          velocity: typeof velocity === 'number' ? velocity : undefined,
          heading: typeof heading === 'number' ? heading : undefined,
          on_ground: Boolean(on_ground),
          last_contact: typeof last_contact === 'number' ? last_contact : undefined
        });
      }
      return acc;
    }, []);
  }

  public cleanup(): void {
    this.cache.close();
  }
}

// Create singleton instance
export const openSkyService = new OpenSkyService(
  process.env.NEXT_PUBLIC_OPENSKY_USERNAME,
  process.env.NEXT_PUBLIC_OPENSKY_PASSWORD
);