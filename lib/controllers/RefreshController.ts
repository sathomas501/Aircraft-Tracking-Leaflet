// lib/controllers/RefreshController.ts
import { debounce } from 'lodash';
import openSkyTrackingService from '@/lib/services/openSkyTrackingService';

export interface RefreshState {
  isRefreshing: boolean;
  refreshType: 'positions' | 'full' | null;
  lastRefreshed: Date | null;
  status: string;
}

class RefreshController {
  private static instance: RefreshController;
  private isRefreshing = false;
  private refreshType: 'positions' | 'full' | null = null;
  private subscribers = new Set<(state: RefreshState) => void>();

  private _state: RefreshState = {
    isRefreshing: false,
    refreshType: null,
    lastRefreshed: null,
    status: '',
  };

  // Singleton accessor
  public static getInstance(): RefreshController {
    if (!RefreshController.instance) {
      RefreshController.instance = new RefreshController();
    }
    return RefreshController.instance;
  }

  // Debounced refresh functions
  private debouncedRefreshPositions = debounce(
    this.refreshPositions.bind(this),
    300
  );
  private debouncedFullRefresh = debounce(this.fullRefresh.bind(this), 300);

  // Public API methods
  public refreshPositionsWithDebounce() {
    if (this.isRefreshing) {
      console.log('Refresh already in progress, ignoring request');
      return;
    }

    this.debouncedRefreshPositions();
  }

  public fullRefreshWithDebounce() {
    if (this.isRefreshing) {
      console.log('Refresh already in progress, ignoring request');
      return;
    }

    this.debouncedFullRefresh();
  }

  // Private implementation methods
  private async refreshPositions() {
    if (!openSkyTrackingService.isTrackingActive()) {
      console.log('No active tracking, skipping refresh');
      return;
    }

    this.updateState({
      isRefreshing: true,
      refreshType: 'positions',
      status: 'Updating aircraft positions...',
    });

    try {
      await openSkyTrackingService.refreshPositionsOnly();

      this.updateState({
        lastRefreshed: new Date(),
        status: 'Position update complete',
      });
    } catch (error) {
      console.error('Position refresh failed:', error);
      this.updateState({
        status: 'Position update failed',
      });
    } finally {
      this.updateState({
        isRefreshing: false,
        refreshType: null,
      });
    }
  }

  private async fullRefresh() {
    if (!openSkyTrackingService.isTrackingActive()) {
      console.log('No active tracking, skipping refresh');
      return;
    }

    this.updateState({
      isRefreshing: true,
      refreshType: 'full',
      status: 'Performing full refresh...',
    });

    try {
      await openSkyTrackingService.refreshNow();

      this.updateState({
        lastRefreshed: new Date(),
        status: 'Full refresh complete',
      });
    } catch (error) {
      console.error('Full refresh failed:', error);
      this.updateState({
        status: 'Full refresh failed',
      });
    } finally {
      this.updateState({
        isRefreshing: false,
        refreshType: null,
      });
    }
  }

  // State management
  private updateState(partialState: Partial<RefreshState>) {
    this._state = { ...this._state, ...partialState };
    this.notifySubscribers();
  }

  public getState(): RefreshState {
    return { ...this._state };
  }

  // Subscription management
  public subscribe(callback: (state: RefreshState) => void): () => void {
    this.subscribers.add(callback);
    callback(this._state);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback(this._state));
  }
}

export default RefreshController.getInstance();
