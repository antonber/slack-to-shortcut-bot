/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@mission-control/integrations"],
};

export default nextConfig;
