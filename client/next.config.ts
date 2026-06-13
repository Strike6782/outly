import type { NextConfig } from "next";
import path from "path";

// Absolute client root — parent dirs have package.json that breaks module resolution
const clientRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: clientRoot,
  turbopack: {
    root: clientRoot,
    resolveAlias: {
      tailwindcss: path.join(clientRoot, "node_modules/tailwindcss"),
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.modules = [
      path.join(clientRoot, "node_modules"),
      ...(config.resolve.modules ?? ["node_modules"]),
    ];
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.svgrepo.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
