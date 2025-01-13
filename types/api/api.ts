// types/api.ts
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

export interface ModelsResponse {
  models?: SelectOption[];
  error?: string;
  message?: string;
}

export interface ManufacturersResponse {
  manufacturers?: SelectOption[];
  error?: string;
  message?: string;
}