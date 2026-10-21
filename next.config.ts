import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export (spec §10: no backend). `next build` writes the site to out/.
  // cacheComponents / partialPrefetching were removed: with output "export" Next 16.4 fails with
  // "PPR cannot be enabled in export mode", and partialPrefetching requires cacheComponents.
  output: "export",
  // GitHub Pages serves the site under /survive-the-crash; the deploy workflow sets BASE_PATH. Local dev uses "/".
  basePath: process.env.BASE_PATH || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
