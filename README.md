# Nirvora — Indian reselling store

Nirvora is the current storefront name; the GitHub repository remains
`zenvora-store`. The name has not been checked for trademark, domain, or other
business conflicts. The app provides a storefront, admin panel, UPI QR and COD
checkout, a job queue and a **manual Meesho sourcing** adapter. None of these
should be described as production-verified until tested with real accounts.

## Current launch status

**Not 100% ready or fully autonomous.** Meesho ordering, stock verification,
tracking updates, payment reconciliation and refunds require human action.
There is no verified Meesho feed in this repository: starter catalogue ideas
are unverified and now install as **drafts with zero stock**. Previously
published products are not automatically changed; an owner must audit those
separately. There is no reliable evidence of bestseller, lowest-price or
return-rate claims. Illustrations are not proof of an exact product.

The UPI flow requires a bank-statement match by the owner; a customer-submitted
UTR alone is not payment confirmation. COD settlement depends on the supplier's
actual checkout and remittance terms: do not assume that Meesho will remit a
margin. For prepaid orders do not charge the customer a second time on delivery.
Enable only fulfilment and payment methods you can actually honour.

Before accepting orders, review [the Assamese launch guide](docs/ASSAMESE_LAUNCH_GUIDE.md),
[owner runbook](docs/OWNER_RUNBOOK.md), [payment setup](docs/PAYMENT_SETUP.md),
and [release process](docs/RELEASE_PROCESS.md). The guide lists the required
business, supplier, payment, support and testing work and makes no legal claims.

## Tech stack

Next.js 15 (App Router, TypeScript strict) · React 19 · Tailwind CSS ·
Prisma 6 + PostgreSQL · zod · bcryptjs · qrcode · nodemailer · vitest ·
ESLint 9 (flat) + Prettier.

Money is handled as **integer paise** everywhere; `Decimal(14,2)` only at the DB
boundary. Prices are GST-inclusive (Indian B2C convention); the tax component is
computed and stored per order line.

## Getting started (local)

Requirements: Node 22.12–24 and PostgreSQL 14+. Prisma engine downloads require access to Prisma’s binary host.

```bash
cp .env.example .env
# edit .env → DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (minimum)
createdb resellix                       # or use a managed DB
npm install
npx prisma migrate deploy
npm run db:seed                         # admin user + clearly-marked demo catalog
npm run dev                             # http://localhost:3000 (admin at /admin)
```

Demo end-to-end flow with zero external accounts: browse → add to cart →
checkout (TEST provider / COD) → payment simulation → supplier order to the
Demo supplier → shipped/delivered → profit finalised — all visibly marked DEMO.

### Scripts

| Script                                         | Purpose                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `npm run dev` / `build` / `start`              | develop / production build / serve                             |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations & demo seed                                  |
| `npm test` / `test:unit` / `test:integration`  | vitest suites (integration needs the test DB from `.env.test`) |
| `npm run test:e2e`                             | 62 E2E specs over real HTTP — start `npm run dev -- --turbopack -p 3100` first (`.env.test` points E2E at :3100); needs the seeded dev DB |
| `npm run cleanup:demo`                         | pre-launch demo-data cleanup — DRY RUN by default; add `-- --execute` to apply |
| `npm run typecheck` / `lint` / `format`        | quality gates                                                  |
| `npm run audit:deps`                           | dependency vulnerability audit                                 |
| `npm run verify`                               | typecheck + lint + test + build (CI gate)                      |

## Repository map

```
prisma/            schema + migrations + demo seed (guarded against production)
src/lib/           all business logic (framework-agnostic, unit-testable)
  pricing/         pricing engine + rule resolution
  checkout/        totals, shipping, coupon evaluation
  orders/          creation, state machine, finance (actual profit), returns
  payments/        UPI QR adapter, TEST adapter, confirmation pipeline, refunds
  suppliers/       adapter abstraction, HTTP-REST adapter, DEMO simulator, webhooks
  jobs/            queue (dedupe/backoff) + runner
  notifications/   templates + providers (console/SMTP)
  auth/            password, sessions, guards
  admin/reports.ts analytics aggregations
src/app/           Next.js routes: storefront pages, /admin panel, /api endpoints
src/components/    UI (storefront, admin, shared primitives)
tests/unit|integration   vitest suites
tests/e2e/               62 HTTP-level E2E specs (real dev server + real DB)
scripts/production-cleanup.ts  pre-launch demo-data cleanup (dry-run default)
docs/PRICING_ENGINE.md   pricing engine + margin protection (start here for money logic)
docs/AUTOMATION.md       what is automated vs needs configuration (5-label map)
docs/ENVIRONMENT.md      every env var: required?, secret?, where to get it
docs/SECURITY.md         security posture + verified controls
docs/SUPPLIER_SETUP.md   CJ / manual / HTTP-REST supplier onboarding
docs/PAYMENT_SETUP.md    UPI QR + COD + refunds
docs/DEPLOYMENT.md       Vercel + Neon deploy + post-deploy checks
docs/TROUBLESHOOTING.md  symptom → cause → fix
docs/SUPPLIER_API.md     supplier integration contract
docs/OWNER_RUNBOOK.md    day-one launch, catalogue strategy, Meesho sourcing, UPI confirmation, alerts
docs/DESIGN_LANGUAGE.md  the visual system (Noir Atelier) and why it is restrained
```

## Compliance notes (not legal advice)

- GST: register if/when required, enter your real GSTIN in Admin → Settings,
  have a CA validate rates per product category and your invoice format.
- Policy pages (returns, shipping, terms, privacy) are starting-point templates —
  review and adapt them to your business and current Indian consumer-protection
  and e-commerce rules before accepting orders.
- KYC (merchant current account for UPI, supplier agreements, business
  registration) is between you and those providers.

## License / authorship

Private project scaffold — all code in this repository was written for this
project. Third-party dependencies remain under their own licenses.
