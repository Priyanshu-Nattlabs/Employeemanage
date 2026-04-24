/**
 * Public URL prefix for this app (must match next.config.basePath).
 * When hosted at https://example.com/job-blueprint-v2/, set NEXT_PUBLIC_BASE_PATH=/job-blueprint-v2 at build time.
 * If env is wrong or missing, we infer from the first path segment so /api rewrites still hit the Nest backend.
 */
export function getApiPrefix(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
  const fromEnv = raw ? (raw.startsWith("/") ? raw : `/${raw}`) : "";

  if (typeof window !== "undefined") {
    const first = window.location.pathname.split("/").filter(Boolean)[0];
    if (first === "job-blueprint-v2") return "/job-blueprint-v2";
    if (first === "job-blueprint") return "/job-blueprint";
  }

  return fromEnv;
}

/** Prefix for static files under `public/` when `basePath` is set (e.g. `/job-blueprint-v2`). Use for `<img src>` — plain `/ui-images/...` breaks when hosted under a subpath. */
export function getAssetPrefix(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
  return raw ? (raw.startsWith("/") ? raw : `/${raw}`) : "";
}

export function publicAssetUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getAssetPrefix()}${p}`;
}
