import { useState, useEffect } from 'react';
import  {fetchManufacturers}  from '../selector/services/aircraftService';
import { SelectOption } from '@/types/base'; // Import SelectOption

export const useFetchManufacturers = () => {
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const loadManufacturers = async () => {
      setLoading(true);
      try {
        const data = await fetchManufacturers();

        if (Array.isArray(data)) {  // ✅ Validate response
          setManufacturers(data);
        } else {
          console.warn('Invalid data format:', data);
          setManufacturers([]);
        }
      } catch (error) {
        console.error('Error fetching manufacturers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadManufacturers();
  }, []);

  return { manufacturers, searchTerm, setSearchTerm, loading };
};