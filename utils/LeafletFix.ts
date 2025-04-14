// utils/LeafletFix.ts
// This file handles Leaflet initialization issues in Next.js

// We need to add this to fix the Leaflet icon issues in Next.js
// Add this file and import it in your _app.tsx or any component that uses Leaflet

export function fixLeafletIcons() {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  // Fix Leaflet icon issues
  import('leaflet').then((L) => {
    // Fix icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });

    console.log('[LeafletFix] Leaflet icons fixed');
  });
}

// Initialize Leaflet
export function initLeaflet() {
  // Fix icons
  fixLeafletIcons();

  // Log success
  console.log('[LeafletFix] Leaflet initialized');
}

export default initLeaflet;
