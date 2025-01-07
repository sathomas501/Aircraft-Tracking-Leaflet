import { useQuery } from '@tanstack/react-query';

export interface AircraftOption {
    value: string;
    label: string;
    count?: number;
  }

interface ApiResponse {
  manufacturers?: AircraftOption[];
  models?: AircraftOption[];
  error?: string;
}

interface AircraftData {
  data: any[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// Main aircraft data query with type support

export const useAircraftData = (manufacturer: string, nNumber: string, model: string, type?: string, ) => {
    return useQuery({
      queryKey: ['aircraft', manufacturer, model, type],
      queryFn: async () => {
      if (!manufacturer && !nNumber) {
        console.log('useAircraftData: No manufacturer or N-Number provided');
        return {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            pageSize: 0,
            totalPages: 0,
            manufacturers: [], // Your manufacturer data
        models: []  // Your model data
          }
        };
      }

      const params = new URLSearchParams();
      if (manufacturer) {
        params.append('manufacturer', manufacturer);
      }
      if (model) {
        params.append('model', model);
      }
      if (nNumber) {
        params.append('nNumber', nNumber);
      }
      const url = `/api/aircraft?${params}`;

      console.log('useAircraftData: Making request:', { url, manufacturer, model, nNumber });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return response.json();
    },
    enabled: Boolean(manufacturer) || Boolean(nNumber)
  });
};

// Base manufacturers query
export const useManufacturers = () => {
  return useQuery<AircraftOption[]>({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      console.log('useManufacturers: Fetching manufacturers');
      const response = await fetch('/api/aircraft-options');
      
      console.log('useManufacturers: API response:', { 
        status: response.status, 
        ok: response.ok 
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      return data.manufacturers || [];
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000 // Consider manufacturers list fresh for 5 minutes
  });
};

// Type-filtered manufacturers query
export const useManufacturersByType = (type: string) => {
  return useQuery<AircraftOption[]>({
    queryKey: ['manufacturers', 'by-type', type],
    queryFn: async () => {
      if (!type) {
        return [];
      }

      console.log('useManufacturersByType: Fetching manufacturers for type:', type);
      const params = new URLSearchParams({ type });
      const response = await fetch(`/api/aircraft-options?${params}`);
      
      console.log('useManufacturersByType: API response:', { 
        status: response.status, 
        ok: response.ok,
        type 
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      return data.manufacturers || [];
    },
    enabled: Boolean(type),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000 // Consider manufacturers list fresh for 5 minutes
  });
};

// Models query with type support
export const useAircraftModels = (manufacturer: string, type?: string) => {
  return useQuery<AircraftOption[]>({
    queryKey: ['models', manufacturer, type],
    queryFn: async () => {
      if (!manufacturer) {
        return [];
      }

      console.log('useAircraftModels: Fetching models for:', { manufacturer, type });
      
      const params = new URLSearchParams({ manufacturer });
      if (type) {
        params.append('type', type);
      }
      const response = await fetch(`/api/aircraft-options?${params}`);
      
      console.log('useAircraftModels: API response:', { 
        status: response.status, 
        ok: response.ok,
        manufacturer,
        type
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      return data.models || [];
    },
    enabled: Boolean(manufacturer),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 60000 // Consider models list fresh for 1 minute
  });
};

// Combined hook for type-aware manufacturer data
export const useTypeAwareManufacturers = (type?: string) => {
  const allManufacturers = useManufacturers();
  const typedManufacturers = useManufacturersByType(type || '');

  return {
    data: type ? typedManufacturers.data : allManufacturers.data,
    isLoading: type ? typedManufacturers.isLoading : allManufacturers.isLoading,
    error: type ? typedManufacturers.error : allManufacturers.error,
    isError: type ? typedManufacturers.isError : allManufacturers.isError
  };
};

