// trackingManager.ts
import { Aircraft } from '@/types/base';

// API Manager for frontend
class TrackingAPIManager {
  private baseUrl = '/api/tracking';
  private icao24sUrl = '/api/aircraft/icao24s';

  async upsertLiveAircraft(aircraftData: Aircraft[]) {
    try {
      const response = await fetch(`${this.baseUrl}/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aircraft: aircraftData }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (error) {
      console.error('❌ API request failed:', error);
      throw error;
    }
  }

  async getTrackedICAOs() {
    try {
      const response = await fetch('/api/tracking/tracked-icaos'); // ✅ Call the API
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data; // Returns an array of ICAO24s
    } catch (error) {
      console.error('❌ Error fetching tracked ICAOs:', error);
      return [];
    }
  }

  async getTrackedAircraft() {
    try {
      const response = await fetch(`${this.baseUrl}/tracked`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    } catch (error) {
      console.error('❌ Error fetching tracked aircraft:', error);
      return [];
    }
  }

  async getTrackedAircraftByICAOs(icao24s: string[], manufacturer: string) {
    if (!manufacturer) {
      throw new Error('Manufacturer parameter is required');
    }

    try {
      const response = await fetch(`${this.icao24sUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24s, manufacturer }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    } catch (error) {
      console.error('❌ Error fetching aircraft by ICAO24:', error);
      return [];
    }
  }

  async updateAircraftPosition(
    icao24: string,
    latitude: number,
    longitude: number,
    heading: number
  ) {
    try {
      const response = await fetch(`${this.baseUrl}/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icao24, latitude, longitude, heading }),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (error) {
      console.error('❌ API request failed:', error);
      throw error;
    }
  }

  async getLiveAircraftData() {
    try {
      const response = await fetch(`${this.baseUrl}/live`);
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    } catch (error) {
      console.error('❌ Error fetching live aircraft data:', error);
      return [];
    }
  }

  async performMaintenance() {
    try {
      const response = await fetch(`${this.baseUrl}/maintenance`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    } catch (error) {
      console.error('❌ Error performing maintenance:', error);
      throw error;
    }
  }

  async deleteAircraft(icao24: string) {
    try {
      const response = await fetch(`${this.baseUrl}/aircraft/${icao24}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting aircraft ${icao24}:`, error);
      return false;
    }
  }
}

// Export singleton instance for frontend use
const trackingManager = new TrackingAPIManager();
export default trackingManager;
