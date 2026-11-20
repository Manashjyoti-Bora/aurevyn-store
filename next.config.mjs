/** @type {import('next').NextConfig} */
import { resolveImageRemoteHosts, toRemotePatterns } from './src/lib/images/remote-hosts.mjs';

const isProd = process.env.NODE_ENV === 'production';

// Remote hosts the image optimizer may fetch from (IMAGE_REMOTE_HOSTS, see
// src/lib/images/remote-hosts.mjs). Resolved once here and inlined for the
// client so <RemoteImage> can route non-listed hosts around the optimizer.
const imageRemoteHosts = resolveImageRemoteHosts(process.env);

// Strict security headers for production.
// CSP notes:
// - 'unsafe-inline' for scripts is required by Next.js unless nonce-based CSP is wired
//   through middleware; it still blocks loading of unapproved external scripts.
// - UPI QR payments are rendered server-side as an inline data image, so no
//   third-party payment origin needs to be allowlisted.
const productionSecurityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const baseSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // No Flash/PDF cross-domain policy files may grant access to this origin.
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  // Isolate the browsing context from cross-origin openers; the UPI intent is
  // a top-level navigation to the customer's UPI app, not an opener.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

// /admin and /account are reachable by URL, so "hidden" is not protection:
// authentication is enforced server-side in their layouts. These headers stop
// a crawler from advertising the addresses when a session-less hit is served
// a login redirect or an error page.
const privateAreaHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Cache-Control', value: 'private, no-store' },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Explicit, not implicit: browser source maps would publish readable
  // server/client source (including internal route names) to every visitor.
  productionBrowserSourceMaps: false,
  headers: async () => [
    {
      source: '/:path*',
      headers: isProd
        ? [...baseSecurityHeaders, ...productionSecurityHeaders]
        : baseSecurityHeaders,
    },
    { source: '/admin', headers: privateAreaHeaders },
    { source: '/admin/:path*', headers: privateAreaHeaders },
    { source: '/account', headers: privateAreaHeaders },
    { source: '/account/:path*', headers: privateAreaHeaders },
    {
      // Uploaded files must never be interpreted as HTML.
      source: '/uploads/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Content-Disposition', value: 'inline' },
      ],
    },
  ],
  env: {
    NEXT_PUBLIC_IMAGE_REMOTE_HOSTS: imageRemoteHosts.join(','),
  },
  images: {
    // Only allow-listed hosts go through /_next/image (an open '**' pattern
    // turns the optimizer into a public fetch proxy). Other https hosts are
    // still displayed, unoptimized, via <RemoteImage>.
    remotePatterns: toRemotePatterns(imageRemoteHosts),
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
