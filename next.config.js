/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  env: {
    OPENSKY_USERNAME: process.env.OPENSKY_USERNAME,
    OPENSKY_PASSWORD: process.env.OPENSKY_PASSWORD,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        path: false,
        tls: false,
        sqlite3: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/opensky-api/:path*',
        destination: 'https://opensky-network.org/api/:path*',
      },
    ];
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { fs: false }; // ✅ Prevents 'fs' from bundling in the client
    }
    return config;
  },
};

module.exports = {
  productionBrowserSourceMaps: false, // Disable source maps in production
};

require('dotenv').config(); // ✅ Load .env at the top

module.exports = {
  reactStrictMode: true,
  env: {
    STATIC_DB_PATH: process.env.STATIC_DB_PATH,
    TRACKING_DB_PATH: process.env.TRACKING_DB_PATH,
  },
};

module.exports = {
  productionBrowserSourceMaps: false, // Disables source maps in production
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = false; // Disable source maps in development
    }
    return config;
  },
};
