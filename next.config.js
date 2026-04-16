/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      'rxing-wasm',
      'sharp',
      'bwip-js',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        { 'rxing-wasm': 'commonjs rxing-wasm' },
        { 'sharp': 'commonjs sharp' },
      ];
    }
    return config;
  },
};

module.exports = nextConfig