// OwnershipTypeFilter.jsx
import React, { useState, useEffect } from 'react';

const OwnershipTypeFilter = ({ onFilterChange, activeFilters = [] }) => {
  // Use all owner types as default if no active filters provided
  const [selectedFilters, setSelectedFilters] = useState(activeFilters || []);

  // Add an effect to sync with parent updates
  useEffect(() => {
    setSelectedFilters(activeFilters || []);
  }, [activeFilters]);

  // Update local state when props change
  useEffect(() => {
    // If activeFilters is empty and it's the initial render, select all by default
    if (activeFilters.length > 0) {
      setSelectedFilters(activeFilters);
    }
  }, [activeFilters]);

  // Define all ownership types with their colors and descriptions
  const ownerTypes = [
    {
      id: 'individual',
      name: 'Individual',
      color: '#43a047',
      description: 'Privately owned by an individual',
    },
    {
      id: 'partnership',
      name: 'Partnership',
      color: '#8e24aa',
      description: 'Partnership between individuals',
    },
    {
      id: 'corp-owner',
      name: 'Corporation',
      color: '#5c6bc0',
      description: 'Corporate entity ownership',
    },
    {
      id: 'co-owned',
      name: 'Co-Owned',
      color: '#9e9e9e',
      description: 'Co-owned by multiple parties',
    },
    {
      id: 'llc',
      name: 'LLC',
      color: '#ffb300',
      description: 'Limited Liability Company',
    },
    {
      id: 'non-citizen-corp',
      name: 'Non-Citizen Corp',
      color: '#5c6bc0',
      description: 'Non-citizen corporation ownership',
    },
    {
      id: 'airline',
      name: 'Airline',
      color: '#e53935',
      description: 'Commercial airline',
    },
    {
      id: 'freight',
      name: 'Freight',
      color: '#f57f17',
      description: 'Freight transportation company',
    },
    {
      id: 'medical',
      name: 'Medical',
      color: '#b71c1c',
      description: 'Medical service provider',
    },
    {
      id: 'media',
      name: 'Media',
      color: '#9e9e9e',
      description: 'Media organization',
    },
    {
      id: 'historical',
      name: 'Historical',
      color: '#9e9e9e',
      description: 'Historical organization or museum',
    },
    {
      id: 'flying-club',
      name: 'Flying Club',
      color: '#9e9e9e',
      description: 'Recreational flying club',
    },
    {
      id: 'emergency',
      name: 'Emergency',
      color: '#c62828',
      description: 'Emergency services',
    },
    {
      id: 'local-govt',
      name: 'Local Government',
      color: '#0288d1',
      description: 'Local government agency',
    },
    {
      id: 'education',
      name: 'Education',
      color: '#039be5',
      description: 'Educational institution',
    },
    {
      id: 'federal-govt',
      name: 'Federal Government',
      color: '#1a75ff',
      description: 'Federal government agency',
    },
    {
      id: 'flight-school',
      name: 'Flight School',
      color: '#00897b',
      description: 'Pilot training institution',
    },
    {
      id: 'leasing-corp',
      name: 'Leasing Corporation',
      color: '#5c6bc0',
      description: 'Aircraft leasing company',
    },
    {
      id: 'military',
      name: 'Military',
      color: '#546e7a',
      description: 'Military aircraft',
    },
    {
      id: 'unknown',
      name: 'Unknown',
      color: '#9e9e9e',
      description: 'Ownership information unavailable',
    },
  ];

  const handleFilterToggle = (typeId) => {
    let newFilters;

    if (selectedFilters.includes(typeId)) {
      // Remove from filters if already selected
      newFilters = selectedFilters.filter((id) => id !== typeId);
    } else {
      // Add to filters if not already selected
      newFilters = [...selectedFilters, typeId];
    }

    setSelectedFilters(newFilters);
    onFilterChange(newFilters); // Apply filter changes immediately
  };

  // Inside your OwnershipTypeFilter component
  const handleOwnerTypeToggle = (typeId) => {
    const newFilters = selectedFilters.includes(typeId)
      ? selectedFilters.filter((id) => id !== typeId)
      : [...selectedFilters, typeId];

    setSelectedFilters(newFilters);
    onFilterChange(newFilters);

    // Add debugging
    console.log(`Toggled ${typeId}, new filters:`, newFilters);
  };

  // For "Select All" button
  const selectAll = () => {
    const allTypeIds = types.map((type) => type.id);
    setSelectedFilters(allTypeIds);
    onFilterChange(allTypeIds);
  };

  // For "Clear All" button
  const clearAll = () => {
    setSelectedFilters([]);
    onFilterChange([]);
  };

  return (
    <div className="filter-content" style={{ width: '100%' }}>
      {ownerTypes.map((type) => (
        <div
          key={type.id}
          className="filter-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            fontSize: '13px',
            cursor: 'pointer',
            backgroundColor: selectedFilters.includes(type.id)
              ? '#f1f5ff'
              : 'transparent',
            borderRadius: '3px',
            margin: '2px 0',
          }}
          onClick={() => handleFilterToggle(type.id)}
        >
          <input
            type="checkbox"
            checked={selectedFilters.includes(type.id)}
            onChange={() => handleOwnerTypeToggle(type.id)}
            style={{ marginRight: '8px' }}
          />
          <div
            style={{
              width: '14px',
              height: '14px',
              backgroundColor: type.color,
              borderRadius: '3px',
              marginRight: '8px',
              flexShrink: 0,
            }}
          ></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '500', fontSize: '12px' }}>
              {type.name}
            </span>
            <span style={{ fontSize: '10px', color: '#666' }}>
              {type.description}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OwnershipTypeFilter;
