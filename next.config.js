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
      config.resolve.fallback.fs = false;
    }
    config.resolve.extensions.push('.ts', '.tsx');
    return config;
  },

  async redirects() {
    return [
      {
        source: '/api/aircraft-leaflet',
        destination: '/api/aircraft-options',
        permanent: true,
      },
    ];
  },



  
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: '/maps/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
        ]
      }
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




module.exports = nextConfig;