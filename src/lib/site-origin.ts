import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { originFromHeaders } from '@/lib/site-url';

/**
 * The canonical origin for the current request.
 *
 * Canonical tags, sitemap entries, robots declarations and JSON-LD `url` values
 * must name the host that actually answers 200 — not whatever a hand-set
 * environment variable happens to say months after a rename. Reading the request
 * host makes that structurally true instead of merely configured.
 *
 * Falls back to the validated `APP_URL` when there is no request to read from
 * (build-time prerender of a static route, unit tests, emails).
 */
export async function publicOrigin(): Promise<string> {
  try {
    const h = await headers();
    return originFromHeaders({
      forwardedHost: h.get('x-forwarded-host'),
      host: h.get('host'),
      forwardedProto: h.get('x-forwarded-proto'),
      fallback: env.APP_URL,
    });
  } catch {
    return env.APP_URL;
  }
}
