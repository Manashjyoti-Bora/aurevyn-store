/**
 * Resolve the canonical public origin of the deployment.
 *
 * Why this exists: `APP_URL` is a hand-set environment variable, so it can go
 * stale. That is not hypothetical — the store was renamed and the variable kept
 * pointing at the old `*.vercel.app` host, which then returned
 * `DEPLOYMENT_NOT_FOUND`. Every canonical tag, sitemap URL, robots declaration
 * and structured-data URL pointed at a dead origin, which is exactly the kind of
 * thing that silently removes a site from Google's index.
 *
 * Vercel injects `VERCEL_PROJECT_PRODUCTION_URL` on every build and at runtime
 * and keeps it correct across renames and domain changes, so it is the more
 * trustworthy source whenever `APP_URL` has not been pointed at a custom domain.
 *
 * Precedence (deliberate, in this order):
 *   1. `APP_URL` that is NOT a `*.vercel.app` host  → the owner attached a custom
 *      domain on purpose; respect it.
 *   2. Vercel's injected production host            → authoritative, never stale.
 *   3. `APP_URL` as given                           → local dev, tests, self-hosting.
 *
 * Pure and dependency-free so it can be unit tested without a database.
 */
export function resolvePublicOrigin(input: {
  appUrl: string;
  vercelProductionHost?: string | undefined;
}): string {
  const appUrl = stripTrailingSlash(input.appUrl.trim());
  const productionHost = input.vercelProductionHost?.trim();

  if (!productionHost) return appUrl;

  let hostname: string;
  try {
    hostname = new URL(appUrl).hostname.toLowerCase();
  } catch {
    // Unparseable APP_URL: the injected production host is strictly better.
    return `https://${productionHost}`;
  }

  const isVercelHost = hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
  if (!isVercelHost) return appUrl;
  if (hostname === productionHost.toLowerCase()) return appUrl;

  return `https://${productionHost}`;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
