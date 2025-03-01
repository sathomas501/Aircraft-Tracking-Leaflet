// lib/services/tracking-data-service-extension.ts
import { TrackingDataService } from './tracking-data-service';
import { BaseDatabaseManager } from '../../db/managers/baseDatabaseManager';
import { ExtendedAircraftRepository } from '../../repositories/aircraft-repository-extension';
import { AircraftModel } from '@/types/aircraft-types';
import type { Aircraft } from '@/types/base';

/**
 * Extended service with additional methods needed by useAircraftSelector
 */
export class ExtendedTrackingDataService extends TrackingDataService {
  private extendedAircraftRepository: ExtendedAircraftRepository;

  constructor(dbManager: BaseDatabaseManager) {
    super(dbManager);
    this.extendedAircraftRepository = new ExtendedAircraftRepository(dbManager);
  }

  /**
   * Get aircraft by ICAO24 codes
   * Override the base method to use the extended repository and caching
   */
  async getAircraftByIcao24s(icao24s: string[]): Promise<Aircraft[]> {
    // Use cache if available
    const cacheKey = `icao24s-${icao24s.sort().join('-')}`;
    const cachedData = await this.cacheService.getWithTTL<Aircraft[]>(cacheKey);

    if (cachedData) {
      console.log(
        `[ExtendedTrackingService] Using cached data for ${icao24s.length} ICAOs`
      );
      return cachedData;
    }

    const aircraft =
      await this.extendedAircraftRepository.getAircraftByIcao24s(icao24s);

    // Cache results for 30 seconds
    if (aircraft.length > 0) {
      await this.cacheService.setWithTTL(cacheKey, aircraft, 30);
    }

    return aircraft;
  }

  /**
   * Get models for a manufacturer with counts
   */
  async getModelsForManufacturer(
    manufacturer: string
  ): Promise<AircraftModel[]> {
    const cacheKey = `models-${manufacturer}`;
    const cachedData =
      await this.cacheService.getWithTTL<AircraftModel[]>(cacheKey);

    if (cachedData) {
      console.log(
        `[ExtendedTrackingService] Using cached models for ${manufacturer}`
      );
      return cachedData;
    }

    const models =
      await this.extendedAircraftRepository.getModelsForManufacturer(
        manufacturer
      );

    // Cache results for 5 minutes
    if (models.length > 0) {
      await this.cacheService.setWithTTL(cacheKey, models, 5 * 60);
    }

    return models;
  }

  /**
   * Get aircraft filtered by manufacturer and model
   */
  async getFilteredAircraft(
    manufacturer: string,
    model?: string
  ): Promise<Aircraft[]> {
    const cacheKey = `filtered-${manufacturer}-${model || 'all'}`;
    const cachedData = await this.cacheService.getWithTTL<Aircraft[]>(cacheKey);

    if (cachedData) {
      console.log(
        `[ExtendedTrackingService] Using cached filtered data for ${manufacturer}${model ? ` (${model})` : ''}`
      );
      return cachedData;
    }

    const aircraft = await this.extendedAircraftRepository.getFilteredAircraft(
      manufacturer,
      model
    );

    // Cache results for 30 seconds
    if (aircraft.length > 0) {
      await this.cacheService.setWithTTL(cacheKey, aircraft, 30);
    }

    return aircraft;
  }
}
