import { useState, useEffect, useCallback } from 'react';
import { fetchManufacturers } from '../selector/services/aircraftService';
import { SelectOption } from '@/types/base';

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Function to fetch manufacturers (reusable)
  const loadManufacturers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('📡 Calling /api/manufacturers...');
      const data = await fetchManufacturers();
      console.log('✅ Received Manufacturers:', data);

      if (Array.isArray(data) && data.length > 0) {
        setManufacturers(data); // ✅ Update manufacturers
      } else {
        console.warn('⚠️ API returned empty manufacturers list:', data);
        setManufacturers([]);
      }
    } catch (error) {
      console.error('❌ Error fetching manufacturers:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch manufacturers on mount
  useEffect(() => {
    loadManufacturers();
  }, [loadManufacturers]);

  return {
    manufacturers,
    searchTerm,
    setSearchTerm,
    loading,
    error,
    reload: loadManufacturers,
  };
};
