// lib/api/trackingApiClient.ts
export class TrackingApiClient {
  private baseUrl = '/api/tracking';
  private static instance: TrackingApiClient | null = null;

  private constructor() {}

  public static getInstance(): TrackingApiClient {
    if (!TrackingApiClient.instance) {
      TrackingApiClient.instance = new TrackingApiClient();
    }
    return TrackingApiClient.instance;
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
}

const trackingApiClient = TrackingApiClient.getInstance();
export default trackingApiClient;
