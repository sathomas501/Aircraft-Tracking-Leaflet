// lib/config/feature-manager.ts
import { FEATURES, FeatureFlag } from './features';

export class FeatureManager {
  private features: Map<string, FeatureFlag>;
  private overrides: Map<string, boolean>;

  constructor() {
    this.features = new Map(
      Object.entries(FEATURES).map(([key, value]) => [
        value.name,
        { ...value, enabled: value.enabled }
      ])
    );
    this.overrides = new Map();
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(featureName: string, context: Record<string, any> = {}): boolean {
    // Check override first
    if (this.overrides.has(featureName)) {
      return this.overrides.get(featureName)!;
    }

    const feature = this.features.get(featureName);
    if (!feature) {
      console.warn(`Feature '${featureName}' not found`);
      return false;
    }

    // Check if feature is enabled at all
    if (!feature.enabled) {
      return false;
    }

    // Check dependencies
    if (feature.dependencies?.length) {
      const dependenciesMet = feature.dependencies.every(dep => 
        this.isEnabled(dep, context)
      );
      if (!dependenciesMet) {
        return false;
      }
    }

    // Check enabledFor/disabledFor lists
    if (context.userId) {
      if (feature.enabledFor?.length && !feature.enabledFor.includes(context.userId)) {
        return false;
      }
      if (feature.disabledFor?.length && feature.disabledFor.includes(context.userId)) {
        return false;
      }
    }

    // Check rollout percentage
    if (typeof feature.rolloutPercentage === 'number') {
      const hash = this.hashString(context.userId || 'anonymous');
      const percentage = (hash % 100) + 1;
      if (percentage > feature.rolloutPercentage) {
        return false;
      }
    }

    // Check expiration
    if (feature.validUntil) {
      const expirationDate = new Date(feature.validUntil);
      if (expirationDate < new Date()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get feature configuration if enabled
   */
  getConfig<T = any>(featureName: string, context: Record<string, any> = {}): T | null {
    if (!this.isEnabled(featureName, context)) {
      return null;
    }

    const feature = this.features.get(featureName);
    return (feature?.config || null) as T;
  }

  /**
   * Set a temporary override for a feature
   */
  setOverride(featureName: string, enabled: boolean): void {
    this.overrides.set(featureName, enabled);
  }

  /**
   * Clear a feature override
   */
  clearOverride(featureName: string): void {
    this.overrides.delete(featureName);
  }

  /**
   * Clear all feature overrides
   */
  clearAllOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures(context: Record<string, any> = {}): string[] {
    return Array.from(this.features.keys())
      .filter(featureName => this.isEnabled(featureName, context));
  }

  /**
   * Get feature metadata
   */
  getFeatureMetadata(featureName: string): Omit<FeatureFlag, 'enabled'> | null {
    const feature = this.features.get(featureName);
    if (!feature) return null;

    const { enabled, ...metadata } = feature;
    return metadata;
  }

  /**
   * Simple string hashing function for consistent percentage rollouts
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Create singleton instance
export const featureManager = new FeatureManager();