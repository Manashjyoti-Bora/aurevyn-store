import dns from 'node:dns/promises';
import net from 'node:net';
import { isBlockedHostname, isPrivateAddress } from './host-guard';

/**
 * Outbound request safety (SSRF defence).
 *
 * Any URL that comes from stored configuration - notably a supplier's
 * `baseUrl` set in Admin → Suppliers - is requested by the SERVER. Without a
 * guard, an admin (or anyone who reaches an admin session) can make the app
 * fetch `http://169.254.169.254/…` (cloud metadata), `http://redis:6379`,
 * `http://postgres:5432` or any other internal-only address, and read the
 * response back through supplier diagnostics.
 *
 * Two layers:
 *  1. `assertSafeOutboundUrl` - scheme allow-list, no embedded credentials,
 *     no localhost/intranet names, and DNS resolution whose EVERY address
 *     must be public.
 *  2. `fetchWithSafeRedirects` - redirects are followed MANUALLY so each hop
 *     is re-validated (a public host can redirect to 127.0.0.1).
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export { isBlockedHostname, isPrivateAddress };

/**
 * Validate an outbound URL and resolve it. Throws with a human-readable
 * reason instead of returning a boolean so diagnostics can explain the block.
 */
export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Outbound URL is not a valid absolute URL');
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(`Outbound URL scheme "${url.protocol}" is not allowed (http/https only)`);
  }
  if (url.username || url.password) {
    throw new Error('Outbound URL must not embed credentials');
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error(
      `Outbound host "${url.hostname}" is a loopback/private/intranet address and is blocked`
    );
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) return url; // public literal, already checked

  let addresses: Array<{ address: string }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error(`Outbound host "${hostname}" could not be resolved`);
  }
  if (addresses.length === 0) {
    throw new Error(`Outbound host "${hostname}" resolved to no addresses`);
  }
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new Error(
        `Outbound host "${hostname}" resolves to a private address (${entry.address}) and is blocked`
      );
    }
  }
  return url;
}

/**
 * `fetch` that re-validates every redirect hop. A redirect to a private
 * address is refused rather than followed.
 */
export async function fetchWithSafeRedirects(
  raw: string,
  init: RequestInit = {},
  maxRedirects = 3
): Promise<Response> {
  let url = await assertSafeOutboundUrl(raw);
  let method = (init.method ?? 'GET').toUpperCase();
  let body = init.body;

  for (let hop = 0; ; hop += 1) {
    const response = await fetch(url.toString(), { ...init, method, body, redirect: 'manual' });
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (!isRedirect) return response;

    const location = response.headers.get('location');
    if (!location) throw new Error(`Upstream returned HTTP ${response.status} without a Location`);
    if (hop >= maxRedirects) throw new Error(`Upstream exceeded ${maxRedirects} redirects`);

    // Release the unread body so the connection can be reused.
    await response.body?.cancel().catch(() => undefined);

    const next = await assertSafeOutboundUrl(new URL(location, url).toString());
    // 301/302/303 downgrade non-GET to GET without a body (per RFC 9110);
    // 307/308 preserve method and body.
    if (response.status !== 307 && response.status !== 308 && method !== 'GET') {
      method = 'GET';
      body = undefined;
    }
    url = next;
  }
}
