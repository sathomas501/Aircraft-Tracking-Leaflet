// types/api/common/responses.ts
import type { SelectOption } from '@/types/base';

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
      manufacturer: string;
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