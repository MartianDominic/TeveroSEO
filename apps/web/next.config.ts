import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@tevero/ui", "@tevero/types"],
};

export default nextConfig;
