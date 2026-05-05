import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed 'output: export' because Keycloak OIDC login requires
  // client-side JS that runs in the browser (not static HTML).
  // The 'export' mode works fine, but we keep the dev server for hot-reload.
  output: 'export',
  allowedDevOrigins: ["10.10.30.86"],
};

export default nextConfig;
