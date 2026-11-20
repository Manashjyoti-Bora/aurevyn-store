/**
 * Pure host/IP classification (no `node:` imports, so client forms can use it).
 *
 * Used by the SSRF guard for outbound supplier calls and by the admin supplier
 * schema, so a private/intranet base URL is refused at save time AND at call
 * time (DNS can change after the record is saved).
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'host.docker.internal',
  'gateway.docker.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_HOST_SUFFIXES = [
  '.local',
  '.localhost',
  '.internal',
  '.intranet',
  '.lan',
  '.home',
  '.arpa',
  '.svc',
  '.cluster.local',
];

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable: refuse
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function ipv4Shape(ip: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
}

function ipv6Shape(ip: string): boolean {
  return ip.includes(':');
}

/** True when the literal IP is loopback/private/link-local/multicast/reserved. */
export function isPrivateAddress(ip: string): boolean {
  const value = ip.trim().toLowerCase();
  if (ipv4Shape(value)) return isPrivateIpv4(value);
  if (!ipv6Shape(value)) return true; // not an IP at all → never "public"
  if (value === '::1' || value === '::') return true;
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (value.startsWith('fc') || value.startsWith('fd')) return true; // ULA
  if (/^fe[89ab]/.test(value)) return true; // link-local
  if (value.startsWith('ff')) return true; // multicast
  return false;
}

/** Hostname-level block list (no DNS traffic). */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (ipv4Shape(host) || ipv6Shape(host)) return isPrivateAddress(host);
  if (!host.includes('.')) return true; // bare label = intranet service name
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export const UNSAFE_OUTBOUND_URL_MESSAGE =
  'Use a public https:// address — loopback, private, link-local and intranet hosts are blocked.';

/** Save-time check for an admin-supplied outbound base URL. */
export function isSafeOutboundBaseUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  return !isBlockedHostname(url.hostname);
}
