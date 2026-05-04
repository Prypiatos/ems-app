import type { NextConfig } from "next";

const apiProxyTarget = process.env.NEXT_PUBLIC_API_PROXY_TARGET ?? "http://127.0.0.1:8000/api/v1";

const nextConfig: NextConfig = {
  output: 'export',
  allowedDevOrigins: ["10.10.30.86"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
