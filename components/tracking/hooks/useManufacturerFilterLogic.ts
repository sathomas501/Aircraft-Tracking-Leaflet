import { useState, useEffect } from 'react';
import { useEnhancedMapContext } from '../context/EnhancedMapContext';
import type { ExtendedAircraft } from '@/types/base';

interface UseManufacturerFilterLogicProps {
  activeDropdown: string | null;
  setActiveDropdown: (dropdown: string | null) => void;
}

export function useManufacturerFilterLogic({
  activeDropdown,
  setActiveDropdown
}: UseManufacturerFilterLogicProps) {
  // Get context state and functions
  const {
    selectedManufacturer,
    selectedModel,
    selectManufacturer,
    selectModel,
    refreshPositions,
    blockManufacturerApiCalls,
    setBlockManufacturerApiCalls,
    isManufacturerApiBlocked,
    setIsManufacturerApiBlocked,
    displayedAircraft,
  } = useEnhancedMapContext();

  // Local state
  const [localLoading, setLocalLoading] = useState(false);
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  // Manufacturer filter methods
  const selectManufacturerAndClose = (value: string) => {
    // Close dropdown
    setActiveDropdown(null);
    setManufacturerSearchTerm('');

    // If clearing the selection
    if (value === '') {
      selectManufacturer(null);
      return;
    }

    // Set the manufacturer selection
    selectManufacturer(value);

    // Fetch manufacturer data
    fetchManufacturerData(value);
  };

  const fetchManufacturerData = (manufacturer: string) => {
    if (isRateLimited) {
      console.log(`Skipping data fetch - rate limited for ${rateLimitTimer}s`);
      return;
    }

    console.log(`Fetching data for manufacturer: ${manufacturer}`);

    try {
      // If you have a context function for this, call it after a slight delay
      if (typeof refreshPositions === 'function') {
        // Apply a small delay to prevent overwhelming the API
        setTimeout(() => {
          refreshPositions().catch((error: any) => {
            if (error.message?.includes('rate limit') || error.status === 429) {
              handleRateLimit(30);
            } else {
              console.error('Error fetching manufacturer data:', error);
            }
          });
        }, 200);
      }
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.status === 429) {
        handleRateLimit(30);
      } else {
        console.error('Error scheduling manufacturer data fetch:', error);
      }
    }
  };

  // Model selection methods
  const handleModelSelect = (value: string) => {
    selectModel(value === '' ? null : value);
    setActiveDropdown(null);
  };

  // Rate limit handling
  const handleRateLimit = (retryAfter: number = 30) => {
    setIsRateLimited(true);
    setRateLimitTimer(retryAfter);
    console.log(`Rate limited by API. Retry after ${retryAfter}s`);

    // Block API calls
    setBlockManufacturerApiCalls(true);
    setIsManufacturerApiBlocked(true);

    // Show notification to user
    if (retryAfter > 0) {
      alert(
        `Aircraft data refresh rate limited. Please wait ${retryAfter} seconds before trying again.`
      );
    }
  };

  // Effect to handle rate limit timer
  useEffect(() => {
    if (isRateLimited && rateLimitTimer) {
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setRateLimitTimer(null);
        console.log('Rate limit timer expired, resuming API calls');
      }, rateLimitTimer * 1000);

      return () => clearTimeout(timer);
    }
  }, [isRateLimited, rateLimitTimer]);

  return {
    // State
    selectedManufacturer,
    selectedModel,
    manufacturerSearchTerm,
    localLoading,
    isRefreshing,
    isRateLimited,
    rateLimitTimer,

    // Methods
    selectManufacturerAndClose,
    handleModelSelect,
    setManufacturerSearchTerm,
    handleRateLimit
  };
}