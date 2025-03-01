// lib/services/model-assignment-service.ts

import type { Aircraft } from '@/types/base';
import { TrackingDatabaseManager } from '../db/managers/trackingDatabaseManager';

export class ModelAssignmentService {
  private static instance: ModelAssignmentService;
  private readonly trackingDb: TrackingDatabaseManager;
  private modelMappings: Map<string, Map<string, string>> = new Map();

  private constructor() {
    this.trackingDb = TrackingDatabaseManager.getInstance();
    this.initializeModelMappings();
  }

  public static getInstance(): ModelAssignmentService {
    if (!ModelAssignmentService.instance) {
      ModelAssignmentService.instance = new ModelAssignmentService();
    }
    return ModelAssignmentService.instance;
  }

  /**
   * Initialize mappings of manufacturers to common models
   */
  private initializeModelMappings(): void {
    // Bombardier model mappings
    const bombardierModels = new Map<string, string>();

    // These are common model prefixes based on ICAO24 ranges
    bombardierModels.set('a0', 'BD-700');
    bombardierModels.set('a1', 'BD-700-1A10');
    bombardierModels.set('a2', 'BD-700-1A11');
    bombardierModels.set('a3', 'CL-600');
    bombardierModels.set('a4', 'CHALLENGER 601');
    bombardierModels.set('a5', 'CHALLENGER 604');
    bombardierModels.set('a6', 'CL-600-2B16');
    bombardierModels.set('a7', 'CL-600-2B19');
    bombardierModels.set('a8', 'GLOBAL 6000');
    bombardierModels.set('a9', 'GLOBAL 5000');
    bombardierModels.set('aa', 'GLOBAL 7500');
    bombardierModels.set('ab', 'GLOBAL 8000');
    bombardierModels.set('ac', 'CHALLENGER 300');
    bombardierModels.set('ad', 'CHALLENGER 350');

    // Add default for any other prefix
    bombardierModels.set('default', 'BD-700');

    // Add to main mappings
    this.modelMappings.set('BOMBARDIER', bombardierModels);

    // Add more manufacturers as needed
    const learjetModels = new Map<string, string>();
    learjetModels.set('default', 'Learjet 75');
    this.modelMappings.set('LEARJET INC', learjetModels);

    const aviatModels = new Map<string, string>();
    aviatModels.set('default', 'A-1 Husky');
    this.modelMappings.set('AVIAT AIRCRAFT INC', aviatModels);
  }

  /**
   * Assign a model to an aircraft based on its ICAO24 code and manufacturer
   */
  public assignModel(aircraft: Aircraft): Aircraft {
    // If already has a model, return as is
    if (aircraft.model) {
      return aircraft;
    }

    const manufacturer = aircraft.manufacturer;
    if (!manufacturer) {
      return aircraft;
    }

    // Get model mappings for this manufacturer
    const manufacturerModels = this.modelMappings.get(manufacturer);
    if (!manufacturerModels) {
      return aircraft;
    }

    // Get the first two characters of the ICAO24 code to use as a prefix
    const prefix = aircraft.icao24.substring(0, 2).toLowerCase();

    // Look up the model by prefix, or use default
    const model =
      manufacturerModels.get(prefix) || manufacturerModels.get('default') || '';

    return {
      ...aircraft,
      model,
    };
  }

  /**
   * Assign models to a batch of aircraft
   */
  public assignModelBatch(aircraft: Aircraft[]): Aircraft[] {
    return aircraft.map((plane) => this.assignModel(plane));
  }

  /**
   * Update all aircraft in the database with model information
   */
  public async updateAllAircraftModels(): Promise<number> {
    try {
      // Get all tracked aircraft
      const allAircraft = await this.trackingDb.getTrackedAircraft();

      console.log(
        `[ModelAssignmentService] Updating models for ${allAircraft.length} aircraft`
      );

      // Assign models
      const updatedAircraft = this.assignModelBatch(allAircraft);

      // Count how many models were assigned
      const assignedCount = updatedAircraft.filter((a) => a.model).length;

      console.log(
        `[ModelAssignmentService] Assigned models to ${assignedCount} aircraft`
      );

      // Update the database
      if (assignedCount > 0) {
        await this.trackingDb.upsertActiveAircraftBatch(updatedAircraft);
      }

      return assignedCount;
    } catch (error) {
      console.error(
        '[ModelAssignmentService] Error updating aircraft models:',
        error
      );
      return 0;
    }
  }

  /**
   * Update models for aircraft of a specific manufacturer
   */
  public async updateManufacturerModels(manufacturer: string): Promise<number> {
    try {
      // Get tracked aircraft for this manufacturer
      const manufacturerAircraft =
        await this.trackingDb.getTrackedAircraft(manufacturer);

      console.log(
        `[ModelAssignmentService] Updating models for ${manufacturerAircraft.length} ${manufacturer} aircraft`
      );

      // Assign models
      const updatedAircraft = this.assignModelBatch(manufacturerAircraft);

      // Count how many models were assigned
      const assignedCount = updatedAircraft.filter((a) => a.model).length;

      console.log(
        `[ModelAssignmentService] Assigned models to ${assignedCount} ${manufacturer} aircraft`
      );

      // Update the database
      if (assignedCount > 0) {
        await this.trackingDb.upsertActiveAircraftBatch(updatedAircraft);
      }

      return assignedCount;
    } catch (error) {
      console.error(
        `[ModelAssignmentService] Error updating ${manufacturer} models:`,
        error
      );
      return 0;
    }
  }
}

// Export singleton instance
export const modelAssignmentService = ModelAssignmentService.getInstance();
