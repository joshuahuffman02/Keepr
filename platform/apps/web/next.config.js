/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  // App Router is enabled by default in Next.js 15
  // Allow additional origins during dev if needed
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.68.64",
    "*.ngrok.io",
    "*.ngrok-free.app",
    "camp.everyday.host.ngrok-free.app",
    "camp-web.ngrok-free.app",
    "camp-api.ngrok-free.app",
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/ai',
        destination: '/campguide',
        permanent: true,
      },
    ];
  },

  // Ensure external workspace packages are bundled correctly
  transpilePackages: ["@campreserv/shared"],
};

module.exports = nextConfig;
