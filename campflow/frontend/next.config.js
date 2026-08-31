/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === "production" ? "/campflow" : ""),
};

module.exports = nextConfig;
