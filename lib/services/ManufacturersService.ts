// lib/services/tracking-services/ManufacturersService.ts
import { SelectOption, RegionCode } from '@/types/base';

type Subscriber = (manufacturers: SelectOption[]) => void;

class ManufacturersService {
  private static instance: ManufacturersService;
  private manufacturers: SelectOption[] = [];
  private loading: boolean = false;
  private subscribers: Subscriber[] = [];
  private lastLoadedRegion: RegionCode | null = null;

  private constructor() {
    console.log('[ManufacturersService] Instance created');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ManufacturersService {
    if (!ManufacturersService.instance) {
      ManufacturersService.instance = new ManufacturersService();
    }
    return ManufacturersService.instance;
  }

  /**
   * Initialize the service with pre-fetched data
   */
  public initializeWithData(data: SelectOption[]): void {
    if (data && data.length > 0) {
      console.log(
        `[ManufacturersService] Initializing with ${data.length} manufacturers from SSR`
      );
      this.manufacturers = data;
      // Notify subscribers about the new data
      this.notifySubscribers();
    } else {
      console.log('[ManufacturersService] No data provided for initialization');
    }
  }

  /**
   * Subscribe to manufacturers updates
   */
  subscribe(callback: Subscriber): () => void {
    this.subscribers.push(callback);

    // Immediately emit current list, if available
    if (this.manufacturers.length > 0) {
      callback(this.manufacturers);
    }

    // Return an unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notify all subscribers with safety checks
   */
  private notifySubscribers(): void {
    console.log(
      `[ManufacturersService] Notifying ${this.subscribers.length} subscribers with ${this.manufacturers.length} manufacturers`
    );

    // Make a safe copy of the data to prevent modifications
    const data = [...this.manufacturers];

    // Use for-of loop to allow for better error handling per subscriber
    for (const subscriber of this.subscribers) {
      try {
        subscriber(data);
      } catch (error) {
        console.error(
          '[ManufacturersService] Error notifying subscriber:',
          error
        );
        // Continue notifying other subscribers even if one fails
      }
    }
  }

  /**
   * Load manufacturers from the API
   */
  async loadManufacturers(region: RegionCode): Promise<void> {
    try {
      const response = await fetch(
        `/api/tracking/manufacturers?region=${region}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data = await response.json();
      this.manufacturers = data.manufacturers || [];

      // Notify all subscribers
      this.subscribers.forEach((cb) => cb(this.manufacturers));
      console.log(
        `[ManufacturersService] Fetched ${this.manufacturers.length} manufacturers for region ${region}`
      );
    } catch (error) {
      console.error(
        `[ManufacturersService] Error fetching manufacturers for region ${region}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get currently loaded manufacturers
   */
  public getManufacturers(): SelectOption[] {
    return this.manufacturers;
  }

  /**
   * Get the last loaded region
   */
  public getLastLoadedRegion(): RegionCode | null {
    return this.lastLoadedRegion;
  }

  /**
   * Clear cached data
   */
  public clearCache(): void {
    console.log('[ManufacturersService] Clearing cache');
    this.manufacturers = [];
    this.lastLoadedRegion = null;
    // Don't notify subscribers as they'll get notified when new data is loaded
  }
}

// Export singleton instance
export const manufacturersService = ManufacturersService.getInstance();

// Also export the class for testing purposes if needed
export default ManufacturersService;
