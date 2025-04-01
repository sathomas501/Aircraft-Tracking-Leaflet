// components/tracking/utils/AircraftStyleInjector.tsx
import { useEffect } from 'react';

const AircraftStyleInjector: React.FC = () => {
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.id = 'aircraft-custom-styles';

    // Add our custom styles
    styleElement.innerHTML = `
      /* Owner-Type Specific Tooltip Styling */
      
      /* Government Aircraft */
      .government-owner .aircraft-tooltip-header,
      .leaflet-tooltip.government-owner .aircraft-tooltip-header,
      .leaflet-tooltip .government-owner .aircraft-tooltip-header {
        background-color: #e6f2ff !important; /* Light blue background */
        border-left: 3px solid #1a75ff !important; /* Brighter blue border */
      }
      
      .government-owner .aircraft-tooltip-content,
      .leaflet-tooltip.government-owner .aircraft-tooltip-content,
      .leaflet-tooltip .government-owner .aircraft-tooltip-content {
        background-color: #f0f7ff !important; /* Very light blue background */
      }
      
      /* Aircraft Popup owner type styling */
      .aircraft-popup.government-owner {
        border-top: 3px solid #1a75ff !important;
      }
      
      .government-owner .popup-button {
        background-color: #1a75ff !important;
      }
      
      /* Corporate Aircraft */
      .corporation-owner .aircraft-tooltip-header,
      .leaflet-tooltip.corporation-owner .aircraft-tooltip-header,
      .leaflet-tooltip .corporation-owner .aircraft-tooltip-header {
        background-color: #f0f0f7 !important; /* Light corporate gray-blue */
        border-left: 3px solid #5c6bc0 !important; /* Indigo border */
      }
      
      .corporation-owner .aircraft-tooltip-content,
      .leaflet-tooltip.corporation-owner .aircraft-tooltip-content,
      .leaflet-tooltip .corporation-owner .aircraft-tooltip-content {
        background-color: #f5f5fa !important; /* Very light gray-blue */
      }
      
      /* Aircraft Popup owner type styling */
      .aircraft-popup.corporation-owner {
        border-top: 3px solid #5c6bc0 !important;
      }
      
      .corporation-owner .popup-button {
        background-color: #5c6bc0 !important;
      }
      
      /* Individual Owner Aircraft */
      .individual-owner .aircraft-tooltip-header,
      .leaflet-tooltip.individual-owner .aircraft-tooltip-header,
      .leaflet-tooltip .individual-owner .aircraft-tooltip-header {
        background-color: #f0f7f0 !important; /* Light green background */
        border-left: 3px solid #43a047 !important; /* Green border */
      }
      
      .individual-owner .aircraft-tooltip-content,
      .leaflet-tooltip.individual-owner .aircraft-tooltip-content,
      .leaflet-tooltip .individual-owner .aircraft-tooltip-content {
        background-color: #f5faf5 !important; /* Very light green background */
      }
      
      /* Aircraft Popup owner type styling */
      .aircraft-popup.individual-owner {
        border-top: 3px solid #43a047 !important;
      }
      
      .individual-owner .popup-button {
        background-color: #43a047 !important;
      }

      /* Ensure tooltip border colors match their theme */
      .leaflet-tooltip.aircraft-tooltip.government-owner,
      .leaflet-tooltip.aircraft-tooltip .government-owner {
        border-color: #1a75ff !important;
      }
      
      .leaflet-tooltip.aircraft-tooltip.corporation-owner,
      .leaflet-tooltip.aircraft-tooltip .corporation-owner {
        border-color: #5c6bc0 !important;
      }
      
      .leaflet-tooltip.aircraft-tooltip.individual-owner,
      .leaflet-tooltip.aircraft-tooltip .individual-owner {
        border-color: #43a047 !important;
      }

      /* Make sure owner type indicators have the right colors */
      .owner-type-indicator.government-owner {
        color: #1a75ff !important;
        font-weight: 700 !important;
      }
      
      .owner-type-indicator.corporation-owner {
        color: #5c6bc0 !important;
        font-weight: 700 !important;
      }
      
      .owner-type-indicator.individual-owner {
        color: #43a047 !important;
        font-weight: 700 !important;
      }
    `;

    // Add the style element to the document head
    document.head.appendChild(styleElement);

    // Clean up when the component unmounts
    return () => {
      const existingStyle = document.getElementById('aircraft-custom-styles');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  // This is a utility component that doesn't render anything
  return null;
};

export default AircraftStyleInjector;
