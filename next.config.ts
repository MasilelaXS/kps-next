import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React Compiler for automatic memoization (eliminates unnecessary re-renders)
  reactCompiler: true,
  
  // Enable Cache Components for explicit caching with instant navigation (PPR)
  cacheComponents: true,
  
  experimental: {
    // Enable Turbopack file system caching for dramatically faster dev startup
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
