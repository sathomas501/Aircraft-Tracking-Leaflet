// hooks/useFilterUILogic.ts
import { useState, useRef, useEffect } from 'react';

export function useFilterUILogic() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  
  // Create refs for dropdown handling
  const dropdownRefs = {
    filter: useRef<HTMLDivElement>(null),
    manufacturer: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    location: useRef<HTMLDivElement>(null),
    region: useRef<HTMLDivElement>(null),
    owner: useRef<HTMLDivElement>(null),
    actions: useRef<HTMLDivElement>(null),
  };
  
  // Toggle dropdown method
  const toggleDropdown = (dropdown: string, event: React.MouseEvent) => {
    if (activeDropdown === dropdown) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(dropdown);
    }
    // Prevent events from bubbling up
    event.stopPropagation();
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside of all dropdowns
      const isOutsideAll = Object.values(dropdownRefs).every(
        (ref) => !ref.current || !ref.current.contains(event.target as Node)
      );
      
      if (isOutsideAll) {
        setActiveDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return {
    activeDropdown,
    setActiveDropdown,
    localLoading,
    setLocalLoading,
    dropdownRefs,
    toggleDropdown
  };
}