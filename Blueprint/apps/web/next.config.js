/** @type {import('next').NextConfig} */

// IDEs often inject root `.env` into the terminal, so `NEXT_PUBLIC_BASE_PATH` can be set even during
// `next dev`. That inlines a path prefix into client bundles while `basePath` is disabled — webpack
// then serves broken `fallback_*` chunks and pages return 500. Force an empty prefix for dev.
const isNextDev =
  process.env.npm_lifecycle_event === "dev" ||
  (process.argv.includes("dev") && !process.argv.includes("build"));

const rawBaseEnv = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
const rawBase = isNextDev ? "" : rawBaseEnv;

// Production / explicit opt-in: nginx-style deploy prefix (e.g. /job-blueprint-v2).
const applyBasePath =
  !!rawBase &&
  (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_DEV_WITH_BASE_PATH === "1");

const nextConfig = {
  ...(isNextDev ? { env: { NEXT_PUBLIC_BASE_PATH: "" } } : {}),
  ...(applyBasePath ? { basePath: rawBase } : {}),
  trailingSlash: true,
  async rewrites() {
    const backend = (process.env.BACKEND_URL || "http://127.0.0.1:8081").replace(/\/$/, "");
    const dest = `${backend}/api/:path*`;
    const routes = [{ source: "/api/:path*", destination: dest }];
    if (applyBasePath) routes.push({ source: `${rawBase}/api/:path*`, destination: dest });
    return routes;
  },
};
module.exports = nextConfig;
