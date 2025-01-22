// lib/services/opensky/index.ts
export * from './service';
export type {
    IOpenSkyService,
    OpenSkyState,
    OpenSkyConfig,
    PositionUpdateCallback,
    WebSocketMessage
} from '@/types/opensky/service';
export type {PositionData} from 'types/base'