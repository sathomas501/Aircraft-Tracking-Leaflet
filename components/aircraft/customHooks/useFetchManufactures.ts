import { useState, useEffect } from 'react';
import { fetchManufacturers } from '../selector/services/aircraftService';
import { SelectOption } from '@/types/base';

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadManufacturers = async () => {
      setLoading(true);
      try {
        console.log('📡 Calling /api/manufacturers...');
        const data = await fetchManufacturers();
        console.log('✅ Received Manufacturers:', data);

        if (Array.isArray(data) && data.length > 0) {
          setManufacturers(data); // ✅ Now correctly setting manufacturers
          console.log('✔️ Manufacturers state updated:', data);
        } else {
          console.warn(
            '⚠️ API returned empty or invalid manufacturers list:',
            data
          );
          setManufacturers([]);
        }
      } catch (error) {
        console.error('❌ Error fetching manufacturers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadManufacturers();
  }, []);

  return { manufacturers, searchTerm, setSearchTerm, loading };
};
