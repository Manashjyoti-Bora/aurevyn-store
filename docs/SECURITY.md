# Security posture

Last verified against code + live deployment: 2026-11-18 (see `docs/AUDIT_2026-09-05.md` for the
route-by-route audit; this file is the summary that must stay true). The 20-item pre-launch
checklist below is the 2026-11-18 review.

## Authentication & authorization
- Session cookies: httpOnly, sameSite, secure in production (`resellix_*` internal names kept
  deliberately; brand-facing name is Zenvora).
- RBAC roles `USER / ADMIN / SUPER_ADMIN`. **Every** admin API and admin page runs
  `requireAdmin()`/RBAC guards (`src/lib/auth/guards.ts`) — verified 401/307 on live probes
  (`/admin` → 307 login, cron without secret → 401).
- Admin bootstrap (`ADMIN_EMAIL/ADMIN_PASSWORD` + seeder) creates an admin only if none exists —
  it never overwrites an existing admin password.

## Input & injection
- All API bodies validated with zod schemas (`src/lib/validation/schemas.ts`); unknown/extra
  fields rejected.
- Prisma parameterised queries everywhere. The only raw SQL (atomic coupon-usage increment) is a
  static statement with bound parameters — no string interpolation.
- XSS: React escaping; no `dangerouslySetInnerHTML` with user content; CSP header restricts
  script sources (Razorpay allowlisted). Live-verified headers: CSP, HSTS, X-Content-Type-Options
  nosniff, X-Frame-Options SAMEORIGIN.
- Uploads: magic-byte sniffing (JPEG/PNG/WEBP/GIF/AVIF only), 5 MB cap, random filenames, served
  with nosniff; extension never trusted.

## Money paths
- Prices, discounts, shipping, COD fees and totals are computed **server-side only** from DB data;
  the client never sends prices. Coupons re-validated at cart AND order creation.
- Minimum-margin floor cannot be bypassed except via an explicit admin-flagged coupon
  (`bypassMarginProtection`) — never silently.
- Razorpay: signature verification of checkout payloads AND webhook HMAC before any state change;
  webhook processing idempotent (no double-capture of payments/orders). Bad signature → 400
  (live-verified).
- No card data, CVV, UPI PINs or payment credentials are ever stored; gateway secrets live only in
  env vars.

## Webhooks & cron
- Generic supplier webhook: `X-Supplier-Signature` HMAC-SHA256 required.
- CJ webhooks are **unsigned by CJ** — the endpoint therefore never trusts payloads: it only
  triggers an authenticated re-fetch (SYNC job). Unknown/unverifiable events return
  `{ok:true, ignored:true}` (live-verified).
- `POST /api/cron/jobs` requires `Authorization: Bearer CRON_SECRET`; job runner is idempotent via
  dedupe keys; retries with backoff.

## Rate limiting & abuse
- Per-IP/per-user limits on register (5/15min), login, password reset, coupon apply, uploads
  (60/15min), contact forms (`src/lib/rate-limit.ts`).
- Counters are **shared across serverless instances** through PostgreSQL
  (`rate_limit_buckets`, migration `20261024210000_rate_limit_buckets`): one atomic
  `INSERT … ON CONFLICT … RETURNING` per hit, so a burst spread over many instances/regions is
  still counted as one client. Keys are stored as SHA-256 digests (no raw IPs/e-mails at rest).
  If the database call fails the hit is counted in process memory instead and a throttled
  warning is logged (abuse brake degrades; checkout never fails because of the counter table).
  Expired rows are purged by the cron housekeeping task. `RATE_LIMIT_STORE=memory` forces the
  process-local store (tests only).

## Image optimizer
- `images.remotePatterns` is an explicit allow-list (`IMAGE_REMOTE_HOSTS`, defaults in
  `src/lib/images/remote-hosts.mjs`) instead of `**`, so `/_next/image` cannot be used as an
  open fetch proxy. Catalogue media from non-listed https hosts is rendered through
  `<RemoteImage>` with `unoptimized` (plain `<img>`), never a runtime error.

## Observability
- `ErrorLog` (with safe error IDs surfaced to customers), `AuditLog` (admin actions),
  `ApiLog`, `OrderEvent` (every status transition), `InventoryMovement` (every stock change).
- Customer-facing errors are generic + reference an ID; stack traces never leave the server.

## Request body limits
- Every JSON route reads its body through `readJson()` (`src/lib/http.ts`), which rejects
  bodies above 1 MB with `413 PAYLOAD_TOO_LARGE` (checked on `Content-Length` and again on the
  actual UTF-8 byte length). This bounds validation work: zod 3.x accumulates one issue per
  failing array element even when the array has `.max()` (GHSA-mrhx-c7xc-m3w5), so body size,
  not schema shape, is what limits memory per request.

## Dependency advisories (2026-10-24)
- `zod <4.6.6` — GHSA-mrhx-c7xc-m3w5 (high, memory exhaustion on oversized arrays). No 3.x
  patch exists; the fix is the zod 4 major. Mitigated here by the request-body cap above plus
  `.max()` on every public array schema. Migrating to zod 4 is tracked as a follow-up: it changes
  `.default()` semantics and error-param names across ~40 schemas and needs its own reviewed PR.
- `tailwindcss 3.x` dev chain (`postcss-selector-parser`, moderate, build-time only; fix is
  Tailwind 4 major) — accepted, not shipped to the browser.

## Pre-launch security checklist (2026-11-18)

| # | Item | Status | Evidence / control |
|---|------|--------|--------------------|
| 1 | SQL injection | Pass | Prisma models/queries are parameterised; the only raw SQL uses tagged templates (`Prisma.sql` / `` $queryRaw``) with bound values — no string interpolation (see `src/lib/rate-limit.ts`, `src/lib/orders/*`, `src/lib/admin/reports.ts`). |
| 2 | XSS | Pass | React escapes by default; the only `dangerouslySetInnerHTML` sinks are JSON-LD through `jsonLdScript()`, which escapes `<`, `>` and `&`; CSP limits script sources to self + Razorpay. |
| 3 | CSRF | Pass | Double-submit token (`resellix_csrf` cookie + `x-csrf-token`) enforced by `apiRoute` on every POST/PATCH/PUT/DELETE; session cookies are `httpOnly` + `SameSite=Lax`. Only signature-authenticated webhooks/cron opt out. |
| 4 | Insecure file uploads | Pass | Admin-only, magic-byte sniffing (JPEG/PNG/WEBP/GIF/AVIF), 5 MB cap, server-generated random filename, extension content-type never trusted, served with `nosniff`; the local provider writes `path.basename(key)` only. |
| 5 | IDOR / object-level authz | Pass | Every customer query is scoped by `userId`; `assertOwnerOrAdmin()` exists for shared resources; guest endpoints need order number **and** email and answer a uniform 404. |
| 6 | Missing rate limiting | Pass | Public endpoints have per-IP/per-account limits; admin mutations now also carry a per-admin, per-action write budget (`requireAdminWrite()`), so a stolen session or a runaway client cannot hammer refunds, repricing or AI actions. |
| 7 | Insecure JWT secrets | N/A | No JWT is issued. Sessions are opaque 256-bit random tokens; only `sha256(token)` is stored. |
| 8 | Exposed API secrets | Pass | All secrets come from `src/lib/env.ts` (server only); the single `NEXT_PUBLIC_` value is the Razorpay **key id**, which is designed to be public. `npm audit`-style literal scans of the repo find no live keys. |
| 9 | Weak password hashing | Pass | bcrypt cost 12 (`src/lib/auth/password.ts`), 72-byte cap, policy (length/letter/digit/common-password list) applied on register and reset. |
| 10 | Multi-factor authentication | **Gap (not implemented)** | No TOTP/WebAuthn second factor yet. Compensating controls: admin panel is server-guarded + `noindex`, login is throttled per IP and per account, no default credentials can exist in production (`ADMIN_*` is only used to bootstrap the first admin), sessions are revocable per user, and every admin mutation is audited. Adding TOTP for ADMIN/STAFF is the recommended next hardening step — it is a feature addition (enrolment UI, recovery codes, two-step login), not a bug fix. |
| 11 | Overly permissive CORS | Pass | No CORS headers are emitted anywhere and there is no `*` origin; the app is same-origin only. |
| 12 | Auth tokens in local storage | Pass | The session lives in an `httpOnly` cookie. `localStorage` holds only recently-viewed products, recent searches and the cookie choice; `sessionStorage` holds only the checkout idempotency key. |
| 13 | Client-side-only permissions | Pass | `/admin` layout calls `getCurrentUser()`/role check server-side and every admin API calls `requireAdmin*()`; hiding UI is never the boundary. |
| 14 | Row-level security | **Not enabled (documented)** | PostgreSQL RLS is not used: the app connects as one Prisma role, and the pooling configuration (`pgbouncer=true`) cannot keep a per-request `SET LOCAL` session variable. Enforcement is application-level and centralised (`guards.ts` + `userId`-scoped queries). Compensating control: the database is never exposed to the browser, and there is a single server runtime. Enabling RLS requires a non-pooled role per request or a DB proxy — tracked, not pretended. |
| 15 | Unverified webhook signatures | Pass | Razorpay webhooks verify HMAC-SHA256 over the raw body before any state change; supplier webhooks verify `X-Supplier-Signature` with a constant-time compare. CJ sends no signature, so its endpoint is trigger-only and never trusts payload fields. |
| 16 | SSRF | Pass (added 2026-11-18) | Admin-supplied supplier `baseUrl` is now validated at save time (`supplierInputSchema` → https + public host) and at call time (`src/lib/net/outbound.ts`): scheme allow-list, no embedded credentials, DNS resolution must be public on **every** address, and redirects are followed manually with each hop re-validated. |
| 17 | Exposed source maps | Pass | `productionBrowserSourceMaps: false` is explicit; no `.map` files are shipped. |
| 18 | Default credentials | Pass | `.env.example` ships empty `ADMIN_EMAIL`/`ADMIN_PASSWORD`; the seeder only creates an admin when none exists; production refuses Razorpay test keys and demo supplier/test-payment modes. |
| 19 | Sensitive data in logs | Pass | `sanitizeForLog()` redacts password/token/secret/signature/card/cookie keys recursively before console and DB persistence; client errors are generic with an error id; no token is logged. |
| 20 | Vulnerable dependencies | Pass | `npm audit` → 0 vulnerabilities (2026-11-18, after updating the typescript-eslint chain). |

## Outbound requests (SSRF)
- Every server-side fetch to a configurable URL goes through `src/lib/net/outbound.ts`
  (`assertSafeOutboundUrl` / `fetchWithSafeRedirects`). Loopback, RFC1918, CGNAT,
  link-local (including `169.254.169.254` cloud metadata), ULA/link-local IPv6 and intranet
  hostnames are refused, and a redirect to such an address is refused rather than followed.

## Known open items (honest list)
- **Multi-factor authentication is not implemented** (checklist item 10). Recommended before
  handing admin access to anyone beyond the founder.
- **PostgreSQL row-level security is not enabled** (checklist item 14); isolation is enforced in
  application code, which is audited but is not a database-level guarantee.
- Real email delivery requires SMTP configuration (until then: console provider, marked as not sent).
- Persistent uploads require S3/Cloudinary configuration on serverless hosts.
- Payments require Razorpay keys; until configured the store honestly reports
  `paymentsConfigured:false` and COD remains the available method.
- Legal/tax compliance (GST registration, invoicing rules, consumer-protection disclosures) is
  flagged for professional verification — this document is not legal advice.
