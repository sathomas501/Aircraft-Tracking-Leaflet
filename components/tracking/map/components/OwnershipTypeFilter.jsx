// OwnershipTypeFilter.jsx
import React, { useState, useEffect } from 'react';

const OwnershipTypeFilter = ({ onFilterChange, activeFilters = [] }) => {
  const [isVisible, setIsVisible] = useState(true);
  // Use all owner types as default if no active filters provided
  const [selectedFilters, setSelectedFilters] = useState(activeFilters);

  // Update local state when props change
  useEffect(() => {
    // If activeFilters is empty and it's the initial render, select all by default
    if (activeFilters.length > 0) {
      setSelectedFilters(activeFilters);
    } else {
      // This else clause no longer needed since we're initializing with all active filters
      // in the EnhancedReactBaseMap component
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

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

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
  };

  const handleSelectAll = () => {
    const allTypeIds = ownerTypes.map((type) => type.id);
    setSelectedFilters(allTypeIds);
  };

  const handleClearAll = () => {
    setSelectedFilters([]);
    // Optional: immediately apply empty filter to show all aircraft
    // onFilterChange([]);
  };

  const applyFilters = () => {
    onFilterChange(selectedFilters);
  };

  return (
    <div
      className="ownership-filter-container"
      style={{
        position: 'absolute',
        bottom: '100px',
        right: '20px',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: '250px',
        overflow: 'hidden',
        height: isVisible ? 'auto' : '36px',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        className="filter-header"
        style={{
          padding: '8px 12px',
          backgroundColor: '#4f46e5',
          borderBottom: isVisible ? '1px solid #4338ca' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'white',
        }}
        onClick={toggleVisibility}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
          Filter by Owner Type
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleVisibility();
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '0 4px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isVisible ? 'Minimize' : 'Expand'}
        >
          {isVisible ? '▼' : '▲'}
        </button>
      </div>

      {isVisible && (
        <>
          <div
            className="filter-actions"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid #eee',
            }}
          >
            <button
              onClick={handleSelectAll}
              style={{
                fontSize: '12px',
                padding: '2px 6px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Select All
            </button>
            <button
              onClick={handleClearAll}
              style={{
                fontSize: '12px',
                padding: '2px 6px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Clear All
            </button>
          </div>

          <div
            className="filter-content"
            style={{
              padding: '8px 0',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            {ownerTypes.map((type) => (
              <div
                key={type.id}
                className="filter-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  backgroundColor: selectedFilters.includes(type.id)
                    ? '#f1f5ff'
                    : 'transparent',
                }}
                onClick={() => handleFilterToggle(type.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedFilters.includes(type.id)}
                  onChange={() => {}} // Handled by div click
                  style={{ marginRight: '8px' }}
                />
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: type.color,
                    borderRadius: '3px',
                    marginRight: '8px',
                    flexShrink: 0,
                  }}
                ></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '500' }}>{type.name}</span>
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    {type.description}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="filter-footer"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderTop: '1px solid #eee',
            }}
          >
            <span style={{ fontSize: '12px', color: '#666' }}>
              {selectedFilters.length} selected
            </span>
            {selectedFilters.length > 0 && (
              <button
                onClick={applyFilters}
                style={{
                  fontSize: '12px',
                  padding: '3px 8px',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
              >
                Apply Filters
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default OwnershipTypeFilter;
