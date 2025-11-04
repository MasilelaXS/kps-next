import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
