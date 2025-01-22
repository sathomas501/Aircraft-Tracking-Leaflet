// lib/services/opensky-integrated/index.ts

// Export all service types
export type {
    IOpenSkyService,
    OpenSkyIntegrated,
} from './types';

// Export the main service instance
export { OpenSkyIntegratedService } from './service';

// Export error types specifically related to OpenSky
export { errorHandler } from '../error-handler';

// Re-export commonly used types from their correct locations
export type { Aircraft, PositionData} from '@/types/base';
export type { WebSocketClient } from '@/types/websocket';
export type { 
    ExtendedAircraft
} from '@/types/opensky';