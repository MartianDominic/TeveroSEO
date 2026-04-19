import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@tevero/ui", "@tevero/types"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
