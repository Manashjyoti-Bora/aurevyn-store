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

// Hostname shapes only; the port is validated separately against its real range.
const DNS_HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const IPV4_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const IPV6_HOST = /^\[[0-9a-f:]+\]$/i;
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i;

/** Split `host[:port]`, returning null unless the port is a real TCP port. */
function splitHostPort(value: string): { host: string; port: string | null } | null {
  const match = /^(.*?)(?::(\d{1,5}))?$/.exec(value);
  if (!match) return null;
  const host = match[1] ?? '';
  const port = match[2] ?? null;
  if (port !== null && (Number(port) < 1 || Number(port) > 65535)) return null;
  return { host, port };
}

/**
 * Origin from the request's own Host headers.
 *
 * This is what makes the canonical tag impossible to get wrong: the page says
 * "I am this URL" using the exact host that served it. Vercel terminates TLS and
 * forwards `x-forwarded-host` / `x-forwarded-proto`.
 *
 * The Host header is attacker-controlled, so it is validated against a strict
 * hostname pattern and anything unexpected falls back to the configured origin.
 * That prevents host-header injection from writing an arbitrary canonical — a
 * classic cache-poisoning and phishing vector.
 */
export function originFromHeaders(input: {
  forwardedHost?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  fallback: string;
}): string {
  const raw = firstValue(input.forwardedHost) || firstValue(input.host);
  if (!raw) return input.fallback;

  const candidate = raw.trim().toLowerCase();
  const parts = splitHostPort(candidate);
  if (!parts) return input.fallback;

  const isLocal = LOCAL_HOST.test(parts.host);
  const isHostShape =
    isLocal || DNS_HOST.test(parts.host) || IPV4_HOST.test(parts.host) || IPV6_HOST.test(parts.host);
  if (!isHostShape) return input.fallback;

  const proto = firstValue(input.forwardedProto)?.toLowerCase();
  const scheme = proto === 'http' || proto === 'https' ? proto : isLocal ? 'http' : 'https';

  return `${scheme}://${parts.host}${parts.port ? `:${parts.port}` : ''}`;
}

function firstValue(value: string | null | undefined): string | undefined {
  // A proxy may append to these headers: "host1, host2" — the first is ours.
  return value?.split(',')[0]?.trim() || undefined;
}
