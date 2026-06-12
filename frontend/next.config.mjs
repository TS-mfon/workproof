/** @type {import('next').NextConfig} */
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required for production builds");
}

const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    webpackBuildWorker: false
  }
};

export default nextConfig;
