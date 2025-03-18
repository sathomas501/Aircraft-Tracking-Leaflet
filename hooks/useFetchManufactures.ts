import { useState, useEffect } from 'react';
import { SelectOption } from '@/types/base';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let manufacturersCache: SelectOption[] = [];
let lastFetchTime = 0;
let isFetching = false;

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();

    if (manufacturersCache.length > 0 && now - lastFetchTime < CACHE_DURATION) {
      console.log('[useFetchManufacturers] ✅ Using cached manufacturers data');
      setManufacturers(manufacturersCache);
      return;
    }

    if (isFetching) return; // ✅ Prevent multiple fetches
    isFetching = true;

    setLoading(true);
    fetch('/api/aircraft/manufacturers', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        manufacturersCache = data.manufacturers;
        lastFetchTime = Date.now();
        setManufacturers(data.manufacturers);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        isFetching = false;
      });
  }, []);

  return { manufacturers, loading, error };
};
