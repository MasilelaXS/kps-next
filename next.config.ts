import type { NextConfig } from "next";
import pkg from './package.json';

const nextConfig: NextConfig = {
  // Output mode for production deployment
  output: 'standalone',
  
  // Inject build-time version into app
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  
  // Enable React Compiler for automatic memoization (stable in Next.js 16)
  reactCompiler: true,
  
  // Disable experimental cacheComponents - not production-ready yet
  // cacheComponents: true,
  
  experimental: {
    // Turbopack file system caching is stable and safe
    turbopackFileSystemCacheForDev: true,
  },
  
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Cache control headers for version management
  async headers() {
    return [
      {
        // Don't cache version.json - always fetch fresh
        source: '/version.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
      {
        // Don't cache HTML pages - allow version updates
        source: '/:path*.html',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate, max-age=0',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
