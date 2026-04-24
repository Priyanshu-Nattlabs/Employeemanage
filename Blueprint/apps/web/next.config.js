/** @type {import('next').NextConfig} */
const rawBase = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const nextConfig = {
  // When served behind nginx at /job-blueprint-v2/, set NEXT_PUBLIC_BASE_PATH=/job-blueprint-v2 at build time.
  ...(rawBase ? { basePath: rawBase } : {}),
  trailingSlash: true,
  async rewrites() {
    const backend = (process.env.BACKEND_URL || "http://127.0.0.1:8081").replace(/\/$/, "");
    const dest = `${backend}/api/:path*`;
    // When `basePath` is set, Next matches rewrites against paths *without* the basePath prefix.
    // To be safe in both local + proxied deployments, we register rewrites for both forms.
    const routes = [{ source: "/api/:path*", destination: dest }];
    if (rawBase) routes.push({ source: `${rawBase}/api/:path*`, destination: dest });
    return routes;
  },
};
module.exports = nextConfig;

