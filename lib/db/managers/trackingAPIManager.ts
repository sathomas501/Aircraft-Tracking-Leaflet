import { Aircraft } from '@/types/base';

interface TrackingResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class TrackingAPIManager {
  // Base URLs for API endpoints
  private readonly baseUrl = '/api/tracking';
  private readonly aircraftUrl = '/api/aircraft';

  // Helper method for API calls with consistent error handling
  private async apiCall<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<TrackingResponse<T>> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`[TrackingManager] ❌ API call failed:`, {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Get tracked aircraft positions from the tracking database
  async getTrackedAircraft(manufacturer?: string): Promise<Aircraft[]> {
    try {
      const params = manufacturer
        ? `?manufacturer=${encodeURIComponent(manufacturer)}`
        : '';
      const response = await this.apiCall<Aircraft[]>(
        `${this.baseUrl}/tracked${params}`
      );
      return response.data || [];
    } catch (error) {
      console.error('[TrackingManager] Failed to get tracked aircraft:', error);
      return [];
    }
  }

  // Update tracking database with new aircraft positions
  async updateTracking(aircraftData: Aircraft[]): Promise<number> {
    try {
      const response = await this.apiCall<{ updatedCount: number }>(
        `${this.baseUrl}/update`,
        {
          method: 'POST',
          body: JSON.stringify({ aircraft: aircraftData }),
        }
      );
      return response.data?.updatedCount || 0;
    } catch (error) {
      console.error('[TrackingManager] Failed to update tracking:', error);
      return 0;
    }
  }

  // Get active aircraft for a specific manufacturer
  async getActiveAircraft(manufacturer: string): Promise<Aircraft[]> {
    try {
      // First get ICAOs for this manufacturer
      const icaoResponse = await this.apiCall<{ icao24List: string[] }>(
        `${this.aircraftUrl}/icao24s`,
        {
          method: 'POST',
          body: JSON.stringify({ manufacturer }),
        }
      );

      if (!icaoResponse.data?.icao24List?.length) {
        return [];
      }

      // Then get positions for these ICAOs
      const positionResponse = await this.apiCall<Aircraft[]>(
        `${this.aircraftUrl}/positions`,
        {
          method: 'POST',
          body: JSON.stringify({
            icao24s: icaoResponse.data.icao24List,
            manufacturer,
          }),
        }
      );

      return positionResponse.data || [];
    } catch (error) {
      console.error('[TrackingManager] Failed to get active aircraft:', error);
      return [];
    }
  }

  // Update a single aircraft's position
  async updatePosition(
    icao24: string,
    latitude: number,
    longitude: number,
    heading: number
  ): Promise<boolean> {
    try {
      await this.apiCall(`${this.baseUrl}/position`, {
        method: 'POST',
        body: JSON.stringify({ icao24, latitude, longitude, heading }),
      });
      return true;
    } catch (error) {
      console.error('[TrackingManager] Failed to update position:', error);
      return false;
    }
  }

  // Get current tracking database stats
  async getTrackingStats(): Promise<{
    activeCount: number;
    lastUpdate: number;
  }> {
    try {
      const response = await this.apiCall<{
        activeCount: number;
        lastUpdate: number;
      }>(`${this.baseUrl}/stats`);
      return response.data || { activeCount: 0, lastUpdate: 0 };
    } catch (error) {
      console.error('[TrackingManager] Failed to get tracking stats:', error);
      return { activeCount: 0, lastUpdate: 0 };
    }
  }

  // Clean up stale tracking data
  async performMaintenance(): Promise<boolean> {
    try {
      await this.apiCall(`${this.baseUrl}/maintenance`, { method: 'POST' });
      return true;
    } catch (error) {
      console.error('[TrackingManager] Failed to perform maintenance:', error);
      return false;
    }
  }

  // Remove aircraft from tracking
  async removeFromTracking(icao24: string): Promise<boolean> {
    try {
      await this.apiCall(`${this.baseUrl}/aircraft/${icao24}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.error('[TrackingManager] Failed to remove aircraft:', error);
      return false;
    }
  }
}

// Export singleton instance
const trackingManager = new TrackingAPIManager();
export default trackingManager;
