import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Ensure dynamic data is not cached by default in build if using static params
  /* config options here */
};

export default nextConfig;
