// types/api/common/responses.ts
import type { SelectOption, OpenSkyStateArray } from '@/types/base';

export interface ApiError {
  error: string;
  message?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ManufacturersResponse {
  manufacturers?: SelectOption[];
  error?: string;
  message?: string;
}

// types/api/common/responses.ts
interface ModelsSuccessResponse {
  models: SelectOption[];
  meta: {
    total: number;
    MANUFACTURER: string;
    timestamp: string;
  };
}

interface ModelsErrorResponse {
  error: string;
  message: string;
  models?: never;
}

type ModelsResponse = ModelsSuccessResponse | ModelsErrorResponse;

export type { ModelsResponse };

export interface IcaoResponseData {
  success: boolean;
  data: {
    MANUFACTURER: string;
    ICAO24List: string[];
    states: OpenSkyStateArray[];
    meta: {
      total: number;
      timestamp: string;
      batches: number;
    };
  };
}

export interface OpenSkyProxyResponse {
  success: boolean;
  data: {
    states: OpenSkyStateArray[];
    timestamp: number;
    meta: {
      total: number;
      requestedIcaos: number;
    };
  };
  error?: string;
  errorType?: string;
}

export interface OpenSkyProxyRequest {
  ICAO24s: string[];
}
