// OwnershipColorKey.jsx
import React, { useState } from 'react';

const OwnershipColorKey = () => {
  const [isVisible, setIsVisible] = useState(true);

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

  return (
    <div
      className="ownership-key-container"
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
        height: isVisible ? 'auto' : '36px',
        overflow: isVisible ? 'visible' : 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        className="key-header"
        style={{
          padding: '8px 12px',
          backgroundColor: '#f5f5f5',
          borderBottom: isVisible ? '1px solid #ddd' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={toggleVisibility}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
          Aircraft Ownership Types
        </h3>
        <span style={{ fontSize: '18px' }}>{isVisible ? '−' : '+'}</span>
      </div>

      {isVisible && (
        <div
          className="key-content"
          style={{
            padding: '8px 0',
            maxHeight: '400px', // Increased height
            overflowY: 'auto',
          }}
        >
          {ownerTypes.map((type) => (
            <div
              key={type.id}
              className="key-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 12px',
                fontSize: '13px',
              }}
            >
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
      )}
    </div>
  );
};

export default OwnershipColorKey;
