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
      id: 'llc',
      name: 'LLC',
      color: '#ffb300',
      description: 'Limited Liability Company',
    },
    {
      id: 'corporation',
      name: 'Corporation',
      color: '#5c6bc0',
      description: 'Corporate entity ownership',
    },
    {
      id: 'government',
      name: 'Government',
      color: '#1a75ff',
      description: 'Government agency owned',
    },
    {
      id: 'military',
      name: 'Military',
      color: '#546e7a',
      description: 'Military aircraft',
    },
    {
      id: 'airline',
      name: 'Airline',
      color: '#e53935',
      description: 'Commercial airline',
    },
    {
      id: 'partnership',
      name: 'Partnership',
      color: '#8e24aa',
      description: 'Jointly owned by multiple entities',
    },
    {
      id: 'nonprofit',
      name: 'Non-Profit',
      color: '#00897b',
      description: 'Non-profit organization owned',
    },
    {
      id: 'education',
      name: 'Educational',
      color: '#039be5',
      description: 'Educational institution owned',
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
        bottom: '20px',
        right: '20px',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: '250px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        className="key-header"
        style={{
          padding: '8px 12px',
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #ddd',
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
            maxHeight: '300px',
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
