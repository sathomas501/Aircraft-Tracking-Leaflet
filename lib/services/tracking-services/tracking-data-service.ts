// lib/services/tracking-data-service.ts
import { AircraftRepository } from '../../repositories/aircraft-repository';
import { TrackingRepository } from '../../repositories/tracking-repository';
import { BaseDatabaseManager } from '../../db/managers/baseDatabaseManager';
import type { Aircraft } from '@/types/base';
// Import the TTL Cache Extension instead
import { ttlCacheExtension } from '../managers/ttl-cache-extension';

/**
 * Service that coordinates between the repositories and provides
 * business logic for aircraft tracking
 */
export class TrackingDataService {
  // Changed from private to protected so subclasses can access
  protected aircraftRepository: AircraftRepository;
  protected trackingRepository: TrackingRepository;
  protected cacheService: typeof ttlCacheExtension;

  constructor(dbManager: BaseDatabaseManager) {
    this.aircraftRepository = new AircraftRepository(dbManager);
    this.trackingRepository = new TrackingRepository(dbManager);
    this.cacheService = ttlCacheExtension;
  }

  /**
   * Get the database status (counts, health)
   */
  async getDatabaseStatus() {
    return this.trackingRepository.getDatabaseState();
  }

  /**
   * Get all actively tracked aircraft for a manufacturer
   */
  async getTrackedAircraft(manufacturer?: string): Promise<Aircraft[]> {
    // Try to get from cache first
    const cacheKey = `tracked-aircraft-${manufacturer || 'all'}`;
    const cachedData = await this.cacheService.getWithTTL<Aircraft[]>(cacheKey);

    if (cachedData) {
      console.log(
        `[TrackingService] ✅ Using cached tracked aircraft for ${manufacturer || 'all'}`
      );
      return cachedData;
    }

    const aircraft =
      await this.aircraftRepository.getTrackedAircraft(manufacturer);

    // Cache the results for 5 minutes
    if (aircraft.length > 0) {
      await this.cacheService.setWithTTL(cacheKey, aircraft, 5 * 60);
    }

    return aircraft;
  }

  /**
   * Get all ICAO24 codes that are being tracked
   */
  async getTrackedIcao24s(): Promise<string[]> {
    const cacheKey = 'tracked-icao24s';
    const cachedData = await this.cacheService.getWithTTL<string[]>(cacheKey);

    if (cachedData) {
      console.log(`[TrackingService] ✅ Using cached ICAO24 list`);
      return cachedData;
    }

    const icaos = await this.aircraftRepository.getTrackedICAOs();

    // Cache the results for 5 minutes
    if (icaos.length > 0) {
      await this.cacheService.setWithTTL(cacheKey, icaos, 5 * 60);
    }

    return icaos;
  }

  /**
   * Get aircraft by ICAO24 codes
   */
  async getAircraftByIcao24s(
    icao24s: string[],
    manufacturer?: string
  ): Promise<Aircraft[]> {
    if (!icao24s.length) return [];

    try {
      return this.aircraftRepository.getByIcao24(icao24s, manufacturer);
    } catch (error) {
      console.error(
        '[TrackingService] Failed to get aircraft by ICAO24:',
        error
      );
      return [];
    }
  }

  /**
   * Batch update aircraft positions
   */
  async updatePositions(
    positions: Array<{
      icao24: string;
      latitude: number;
      longitude: number;
      altitude?: number;
      velocity?: number;
      heading?: number;
      on_ground?: boolean;
      manufacturer?: string;
    }>
  ): Promise<number> {
    if (!positions.length) return 0;

    // Transform positions to Aircraft objects
    const aircraft: Aircraft[] = positions.map((pos) => ({
      icao24: pos.icao24,
      latitude: pos.latitude,
      longitude: pos.longitude,
      altitude: pos.altitude || 0,
      velocity: pos.velocity || 0,
      heading: pos.heading || 0,
      on_ground: pos.on_ground || false,
      last_contact: Math.floor(Date.now() / 1000),
      manufacturer: pos.manufacturer || '',
      isTracked: true,
      'N-NUMBER': '',
      model: '',
      TYPE_AIRCRAFT: '',
      OWNER_TYPE: '',
      NAME: '',
      CITY: '',
      STATE: '',
    }));

    const updatedCount =
      await this.aircraftRepository.upsertActiveAircraftBatch(aircraft);

    // Invalidate relevant caches
    const manufacturers = new Set(
      positions.map((p) => p.manufacturer).filter(Boolean)
    );
    for (const manufacturer of manufacturers) {
      await this.cacheService.invalidate(`tracked-aircraft-${manufacturer}`);
    }
    await this.cacheService.invalidate('tracked-aircraft-all');
    await this.cacheService.invalidate('tracked-icao24s');

    return updatedCount;
  }

  /**
   * Add aircraft for tracking (pending status)
   */
  async addAircraftForTracking(
    icao24s: string[],
    manufacturer: string
  ): Promise<number> {
    return this.trackingRepository.addPendingAircraft(icao24s, manufacturer);
  }

  /**
   * Run maintenance tasks (mark stale, cleanup)
   */
  async performMaintenance(): Promise<{ cleaned: number; marked: number }> {
    const result = await this.trackingRepository.performMaintenance();

    // Invalidate caches after maintenance
    await this.cacheService.invalidate('tracked-aircraft-all');
    await this.cacheService.invalidate('tracked-icao24s');

    return result;
  }

  /**
   * Get aircraft that need position updates (pending, stale)
   */
  async getAircraftForUpdate(manufacturer?: string): Promise<{
    pending: string[];
    stale: string[];
    active: string[];
  }> {
    const [pending, stale, active] = await Promise.all([
      this.trackingRepository.getPendingIcao24s(manufacturer),
      this.trackingRepository.getStaleIcao24s(manufacturer),
      this.trackingRepository.getActiveIcao24s(manufacturer),
    ]);

    return { pending, stale, active };
  }

  /**
   * Update a single aircraft position
   */
  async updateSinglePosition(
    icao24: string,
    position: {
      latitude: number;
      longitude: number;
      heading: number;
      altitude?: number;
      velocity?: number;
      on_ground?: boolean;
    }
  ): Promise<boolean> {
    const success = await this.aircraftRepository.updatePosition(
      icao24,
      position
    );

    if (success) {
      // Invalidate relevant caches
      await this.cacheService.invalidate('tracked-aircraft-all');
      await this.cacheService.invalidate('tracked-icao24s');
    }

    return success;
  }

  /**
   * Mark an aircraft as active with position data
   */
  async markAsActive(
    icao24: string,
    latitude: number,
    longitude: number,
    altitude?: number,
    velocity?: number,
    heading?: number,
    on_ground?: boolean
  ): Promise<boolean> {
    return this.trackingRepository.markAsActive(
      icao24,
      latitude,
      longitude,
      altitude,
      velocity,
      heading,
      on_ground
    );
  }

  /**
   * Update statuses based on timestamps
   */
  async updateAircraftStatuses(): Promise<void> {
    await this.trackingRepository.updateAircraftStatus();

    // Invalidate caches after status updates
    await this.cacheService.invalidate('tracked-aircraft-all');
    await this.cacheService.invalidate('tracked-icao24s');
  }
}
