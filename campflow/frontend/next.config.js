/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/campflow" : "");

const nextConfig = {
  reactStrictMode: true,
  basePath: basePath,
  async rewrites() {
    if (!basePath) {
      return [
        {
          source: "/campflow",
          destination: "/",
        },
        {
          source: "/campflow/:path*",
          destination: "/:path*",
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
