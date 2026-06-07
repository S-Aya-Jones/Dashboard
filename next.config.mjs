/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from bundling sql.js — it needs native WASM loading
      const existing = Array.isArray(config.externals) ? config.externals : (config.externals ? [config.externals] : []);
      config.externals = [...existing, "sql.js"];
    }
    return config;
  },
};

export default nextConfig;
