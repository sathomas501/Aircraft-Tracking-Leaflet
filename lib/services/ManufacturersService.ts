// lib/services/tracking-services/ManufacturersService.ts
import { SelectOption } from '@/types/base';

class ManufacturersService {
  private static instance: ManufacturersService;
  private manufacturers: SelectOption[] = [];
  private loading: boolean = false;
  private subscribers: Array<(manufacturers: SelectOption[]) => void> = [];

  private constructor() {}

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
    }
  }
  /**
   * Subscribe to manufacturers updates
   */
  public subscribe(
    callback: (manufacturers: SelectOption[]) => void
  ): () => void {
    this.subscribers.push(callback);

    // Immediately notify with current data if available
    if (this.manufacturers.length > 0) {
      callback(this.manufacturers);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== callback);
    };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.manufacturers);
    }
  }

  /**
   * Load manufacturers from the API
   */
  public async loadManufacturers(): Promise<SelectOption[]> {
    if (this.loading) {
      return this.manufacturers;
    }

    // If we already have manufacturers loaded, return them
    if (this.manufacturers.length > 0) {
      return this.manufacturers;
    }

    this.loading = true;

    try {
      console.log('[ManufacturersService] Fetching manufacturers...');
      const response = await fetch('/api/tracking/manufacturers');

      if (!response.ok) {
        throw new Error(
          `Failed to fetch manufacturers: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`[ManufacturersService] Loaded ${data.length} manufacturers`);

      this.manufacturers = data || [];

      // Notify subscribers
      this.notifySubscribers();

      return this.manufacturers;
    } catch (error) {
      console.error(
        '[ManufacturersService] Error loading manufacturers:',
        error
      );
      return [];
    } finally {
      this.loading = false;
    }
  }


}

const manufacturersService = ManufacturersService.getInstance();
export default manufacturersService;
