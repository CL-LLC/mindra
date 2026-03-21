/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable PWA capabilities
  experimental: {
    // Enable server actions for Convex
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Image domains for stock photos
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflarestream.com',
      },
    ],
  },
};

export default nextConfig;
