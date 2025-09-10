import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Firebase Hosting
  output: "export",
  webpack: (config) => {
    // Avoid bundling optional pretty logger in browser builds
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "pino-pretty": false as unknown as string,
    };
    return config;
  },
};

export default nextConfig;
