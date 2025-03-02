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
    const cacheKey = `icao24s-${icao24s.sort().join('-')}`;

    // ✅ Use explicit casting instead of generic type argument
    const cachedData = (await this.cacheService.getWithTTL(cacheKey)) as
      | Aircraft[]
      | null;

    if (cachedData) {
      console.log(
        `[ExtendedTrackingService] Using cached data for ${icao24s.length} ICAOs`
      );
      return cachedData;
    }

    const aircraft =
      await this.extendedAircraftRepository.getAircraftByIcao24s(icao24s);

    // ✅ Remove type argument and explicitly cast
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

    // ✅ Explicit casting instead of generic type argument
    const cachedData = (await this.cacheService.getWithTTL(cacheKey)) as
      | AircraftModel[]
      | null;

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

    // ✅ Explicit casting instead of generic type argument
    const cachedData = (await this.cacheService.getWithTTL(cacheKey)) as
      | Aircraft[]
      | null;

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

    if (aircraft.length > 0) {
      await this.cacheService.setWithTTL(cacheKey, aircraft, 30);
    }

    return aircraft;
  }
}
