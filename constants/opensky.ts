// lib/constants/opensky.ts

export const OPENSKY_CONSTANTS = {
    // Unauthenticated user limits
    UNAUTHENTICATED: {
        REQUESTS_PER_10_MIN: 100,   // 100 requests per rolling window of 10 minutes
        REQUESTS_PER_DAY: 2000,     // Limited on IP basis
        MAX_BATCH_SIZE: 25          // Maximum number of aircraft to track at once
    },

    // Authenticated user limits
    AUTHENTICATED: {
        REQUESTS_PER_10_MIN: 600,   // 600 requests per rolling window of 10 minutes
        REQUESTS_PER_DAY: 4000,     // Per user basis
        MAX_BATCH_SIZE: 100         // Maximum number of aircraft to track at once
    },

    // Time windows
    TIME_WINDOWS: {
        TEN_MINUTES_MS: 10 * 60 * 1000,
        ONE_DAY_MS: 24 * 60 * 60 * 1000
    },

    // API configuration
    API: {
        BASE_URL: 'https://opensky-network.org/api',
        STATES_ENDPOINT: '/states/all',
        TIMEOUT_MS: 15000,          // 15 seconds
        MIN_POLLING_INTERVAL: 5000,  // 5 seconds
        MAX_POLLING_INTERVAL: 30000, // 30 seconds
        DEFAULT_RETRY_LIMIT: 3
    }
};