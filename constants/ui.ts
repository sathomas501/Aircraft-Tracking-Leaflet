// src/constants/ui.ts
export const UI_CONSTANTS = {
  BREAKPOINTS: { 
    SM: 640, 
    MD: 768, 
    LG: 1024, 
    XL: 1280 
  },
  SIZES: {
    ICON: { SM: 16, MD: 24, LG: 32, XL: 48 },
    MODAL: { SM: 400, MD: 600, LG: 800, XL: 1000 },
  },
  Z_INDEX: { 
    MODAL: 50, 
    POPUP: 40, 
    DROPDOWN: 30, 
    STICKY: 20 
  },
  TIMING: { 
    REFRESH_INTERVAL: 15000, 
    ERROR_DISPLAY: 5000, 
    TOOLTIP_DELAY: 200 
  },
  LOADING: {
    SIZES: { SM: 'sm', MD: 'md', LG: 'lg', XL: 'xl' },
    MESSAGES: {
      AIRCRAFT: 'Loading aircraft data...',
      MAP: 'Loading map...',
      MANUFACTURERS: 'Loading manufacturers...',
      MODELS: 'Loading models...',
    },
  }
} as const;
