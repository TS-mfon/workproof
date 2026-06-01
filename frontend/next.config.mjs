/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    webpackBuildWorker: false
  }
};

export default nextConfig;
