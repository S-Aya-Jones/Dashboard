/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Raise body size limit for large Anki deck uploads (228 MB+)
      bodySizeLimit: "400mb",
    },
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
