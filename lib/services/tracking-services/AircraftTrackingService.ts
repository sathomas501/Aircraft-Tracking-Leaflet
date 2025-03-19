// lib/services/AircraftTrackingService.ts

import { ExtendedAircraft, Aircraft, SelectOption } from '@/types/base';

import { AircraftModel } from '@/types/aircraft-models';

/**

 * A simplified service for tracking aircraft data

 */

class AircraftTrackingService {
  private static instance: AircraftTrackingService;

  private trackedAircraft: Aircraft[] = [];

  private models: AircraftModel[] = [];

  private selectedManufacturer: string | null = null;

  private subscribers = {
    aircraft: new Set<(aircraft: Aircraft[]) => void>(),

    models: new Set<(models: AircraftModel[]) => void>(),

    status: new Set<(status: string) => void>(),
  };

  private currentStatus: string = '';

  private loading: boolean = false;

  // Private constructor for singleton

  private constructor() {}

  /**

   * Get the singleton instance

   */

  public static getInstance(): AircraftTrackingService {
    if (!AircraftTrackingService.instance) {
      AircraftTrackingService.instance = new AircraftTrackingService();
    }

    return AircraftTrackingService.instance;
  }

  /**

   * Set the loading state and notify subscribers

   */

  private setLoading(isLoading: boolean): void {
    this.loading = isLoading;

    this.setStatus(isLoading ? 'Loading...' : '');
  }

  /**

   * Update the current status and notify subscribers

   */

  private setStatus(status: string): void {
    this.currentStatus = status;

    this.subscribers.status.forEach((callback) => callback(status));
  }

  /**

   * Get the current tracking status

   */

  public getStatus(): string {
    return this.currentStatus;
  }

  /**

   * Get the current loading state

   */

  public isLoading(): boolean {
    return this.loading;
  }

  /**

   * Subscribe to aircraft updates

   */

  public subscribeToAircraft(
    callback: (aircraft: Aircraft[]) => void
  ): () => void {
    this.subscribers.aircraft.add(callback);

    // Immediately notify with current data

    if (this.trackedAircraft.length > 0) {
      callback(this.trackedAircraft);
    }

    // Return unsubscribe function

    return () => {
      this.subscribers.aircraft.delete(callback);
    };
  }

  /**

   * Subscribe to model updates

   */

  public subscribeToModels(
    callback: (models: AircraftModel[]) => void
  ): () => void {
    this.subscribers.models.add(callback);

    // Immediately notify with current data

    if (this.models.length > 0) {
      callback(this.models);
    }

    // Return unsubscribe function

    return () => {
      this.subscribers.models.delete(callback);
    };
  }

  /**

   * Subscribe to status updates

   */

  public subscribeToStatus(callback: (status: string) => void): () => void {
    this.subscribers.status.add(callback);

    // Immediately notify with current status

    callback(this.currentStatus);

    // Return unsubscribe function

    return () => {
      this.subscribers.status.delete(callback);
    };
  }

  /**

   * Track aircraft for a specific manufacturer

   */

  public async trackManufacturer(manufacturer: string | null): Promise<void> {
    if (manufacturer === this.selectedManufacturer) {
      return; // No change needed
    }

    this.selectedManufacturer = manufacturer;

    this.setLoading(true);

    try {
      if (!manufacturer) {
        // Clear data if no manufacturer is selected

        this.trackedAircraft = [];

        this.models = [];

        this.notifyAircraftSubscribers();

        this.notifyModelSubscribers();

        this.setStatus('');

        return;
      }

      this.setStatus(`Loading data for ${manufacturer}...`);

      // Fetch aircraft for this manufacturer

      await this.fetchAircraft(manufacturer);

      // Fetch models for this manufacturer

      await this.fetchModels(manufacturer);

      this.setStatus(
        `Tracking ${this.trackedAircraft.length} aircraft from ${manufacturer}`
      );
    } catch (error) {
      console.error('Error tracking manufacturer:', error);

      this.setStatus(`Error loading data for ${manufacturer}`);
    } finally {
      this.setLoading(false);
    }
  }

  /**

   * Fetch aircraft for a manufacturer from the API

   */

  private async fetchAircraft(manufacturer: string): Promise<void> {
    try {
      // This should call an endpoint that returns individual aircraft

      const response = await fetch(
        `/api/tracking/manufacturer/${encodeURIComponent(manufacturer)}`,

        {
          method: 'GET',

          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch aircraft: ${response.statusText}`);
      }

      const data = await response.json();

      this.trackedAircraft = data.aircraft || [];

      // Notify subscribers

      this.notifyAircraftSubscribers();
    } catch (error) {
      console.error('Error fetching aircraft:', error);

      this.trackedAircraft = [];

      this.notifyAircraftSubscribers();

      throw error;
    }
  }

  /**

   * Fetch models for a manufacturer from the API

   */

  private async fetchModels(manufacturer: string): Promise<void> {
    try {
      // This is correctly calling the models endpoint

      const response = await fetch(`/api/aircraft/models`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({ manufacturer, refresh: false }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();

      this.models = data.models || [];

      // Notify subscribers

      this.notifyModelSubscribers();
    } catch (error) {
      console.error('Error fetching models:', error);

      this.models = [];

      this.notifyModelSubscribers();

      throw error;
    }
  }

  /**

   * Get aircraft filtered by model

   */

  public getFilteredAircraft(modelFilter?: string): Aircraft[] {
    if (!modelFilter) {
      return this.trackedAircraft;
    }

    return this.trackedAircraft.filter(
      (aircraft) =>
        aircraft.model === modelFilter || aircraft.TYPE_AIRCRAFT === modelFilter
    );
  }

  /**

   * Get all models for the current manufacturer

   */

  public getModels(): AircraftModel[] {
    return this.models;
  }

  /**

   * Get extended aircraft information with additional properties

   */

  public getExtendedAircraft(modelFilter?: string): ExtendedAircraft[] {
    const filtered = this.getFilteredAircraft(modelFilter);

    return filtered.map((aircraft) => ({
      ...aircraft,

      type: aircraft.TYPE_AIRCRAFT || 'Unknown',

      isGovernment: aircraft.OWNER_TYPE === '5',
    })) as ExtendedAircraft[];
  }

  /**

   * Notify all aircraft subscribers

   */

  private notifyAircraftSubscribers(): void {
    this.subscribers.aircraft.forEach((callback) =>
      callback(this.trackedAircraft)
    );
  }

  /**

   * Notify all model subscribers

   */

  private notifyModelSubscribers(): void {
    this.subscribers.models.forEach((callback) => callback(this.models));
  }

  /**

   * Refresh aircraft data

   */

  public async refreshAircraft(): Promise<void> {
    if (!this.selectedManufacturer) return;

    this.setStatus(`Refreshing aircraft for ${this.selectedManufacturer}...`);

    this.setLoading(true);

    try {
      await this.fetchAircraft(this.selectedManufacturer);

      this.setStatus(
        `Updated ${this.trackedAircraft.length} aircraft for ${this.selectedManufacturer}`
      );
    } catch (error) {
      this.setStatus('Failed to refresh aircraft data');
    } finally {
      this.setLoading(false);
    }
  }

  /**

   * Refresh model data

   */

  public async refreshModels(): Promise<void> {
    if (!this.selectedManufacturer) return;

    this.setStatus(`Refreshing models for ${this.selectedManufacturer}...`);

    this.setLoading(true);

    try {
      await this.fetchModels(this.selectedManufacturer);

      this.setStatus(
        `Updated ${this.models.length} models for ${this.selectedManufacturer}`
      );
    } catch (error) {
      this.setStatus('Failed to refresh model data');
    } finally {
      this.setLoading(false);
    }
  }
}

// Export a singleton instance

const aircraftTrackingService = AircraftTrackingService.getInstance();

export default aircraftTrackingService;
