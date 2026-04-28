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
    // Local dev safety: if basePath env is set but URL isn't hosted under it, don't prepend it.
    if (fromEnv && !window.location.pathname.startsWith(fromEnv + "/") && window.location.pathname !== fromEnv) {
      return "";
    }
  }

  return fromEnv;
}

/**
 * Same-origin URLs for `/api/*` when Next.js uses `trailingSlash: true`.
 * Requests without a trailing slash get a 308 to `.../`; fetch often drops `Authorization` on that redirect,
 * breaking Bearer-authenticated calls (manager/org-auth dashboards).
 */
export function apiUrl(pathAndQuery: string): string {
  const prefix = getApiPrefix();
  let p = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  p = `${prefix}${p}`;
  if (p.includes("?")) {
    const qi = p.indexOf("?");
    let pathname = p.slice(0, qi);
    const qs = p.slice(qi);
    if (!pathname.endsWith("/")) pathname += "/";
    return pathname + qs;
  }
  return p.endsWith("/") ? p : `${p}/`;
}

/** Prefix for static files under `public/` when `basePath` is set (e.g. `/job-blueprint-v2`). Use for `<img src>` — plain `/ui-images/...` breaks when hosted under a subpath. */
export function getAssetPrefix(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
  return raw ? (raw.startsWith("/") ? raw : `/${raw}`) : "";
}

/** Client-side path including `basePath`, with trailing slash (matches next.config `trailingSlash`). */
export function appPath(path: string): string {
  const base = getAssetPrefix().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const joined = `${base}${p}`;
  const withSlash = joined.endsWith("/") ? joined : `${joined}/`;
  return withSlash || (p.endsWith("/") ? p : `${p}/`);
}

export function publicAssetUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getAssetPrefix()}${p}`;
}
