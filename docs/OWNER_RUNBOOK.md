# Owner runbook — Nirvora store

Everything the owner has to do to run this store, in order. Nothing here needs a
developer, and no payment API keys exist to manage: payments are UPI QR and Cash
on Delivery only.

> Never paste a secret into chat, an issue or a commit. Environment values go
> into your host's dashboard (Vercel → Settings → Environment Variables), and
> the store UPI ID is safest entered in **Admin → Settings** because it is not a
> secret and needs no redeploy.

## 1. What the site needs to be live

| Setting | Where | Required | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | host env | yes | PostgreSQL (Neon/Supabase/RDS). Applied with `npm run db:deploy` once per deploy. |
| `APP_URL` | host env | yes | The real public origin, e.g. `https://zenvorastore.vercel.app`. Used by emails, canonical/OG tags, sitemap. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | host env | yes | First-boot admin account. Change the password after first sign-in. |
| `SESSION_SECRET` | host env | yes | Random 32+ characters. |
| **Store UPI ID** | **Admin → Settings → Payments** | to accept prepaid | The QR pays this VPA. Leave blank to offer COD only. `UPI_VPA` in env overrides it. |
| `SMTP_*` + `EMAIL_PROVIDER=smtp` | host env | for email | Without it, order/refund emails are only written to server logs. |
| `PAYMENTS_TEST_MODE` | host env | — | Leave `false`. It can never activate in a production build. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | host env | optional | Instant push when a customer submits a UPI reference. Email still goes out if these are unset. |
| `CRON_SECRET` | host env | recommended | Protects `/api/cron/jobs` (Vercel cron entry lives in `vercel.json`). |

Business identity (legal name, GSTIN, address), support email/phone, COD toggle
and policy windows live in **Admin → Settings**. Fill them before taking money —
invoices, policy pages and the AI co-founder read from them.

## 2. First launch checklist

1. `npm run db:deploy` against the production database (or let the release build
   do it), then `npm run db:create-admin` if no admin exists.
2. Sign in at `/admin` and set: business identity, support email, COD on/off,
   **store UPI ID**, shipping rates, return/cancellation windows.
3. **Catalogue.** Deploys never install products. The starter installer creates
   unverified **drafts with zero stock**, not real Meesho listings. Verify the
   exact supplier URL, price, stock, specifications, delivery and image rights
   before publishing. Existing products are untouched; audit any already-live
   products separately. Do not claim bestseller or low-return status without data.
4. Place one real ₹1 order, pay it by UPI, and confirm it with **Mark received**
   in Admin → Payments (see `docs/PAYMENT_SETUP.md`).
5. Check `/api/health` returns `status: "ok"`, `paymentsConfigured: true`, and
   `emailConfigured: true`.

## 3. Daily operations (5 minutes)

- **Admin → Payments** — confirm UPI references against the bank statement.
  Confirm only what is visible as a credit.
- **Admin → Orders** — fulfil paid orders; mark COD cash collected after
  delivery.
- **Admin → Refunds** — pay refunds out, then *Settle manually* with the payout
  reference.
- **Admin → Health** — database, payments, email and launch blockers.
- **Admin → Operations** — job queue, supplier sync and automation posture.

## 4. Catalogue strategy: what we list, and why

Nirvora resells from Meesho today. CJ Dropshipping will be added as a second
supplier once that account is funded; the supplier layer already supports it, so
adding it is a supplier record, not a code change.

Choose products based on current, verifiable supplier information and your
own order and return data. Do not assume any category, price or product has the
lowest return rate or highest sales. Account for shipping, fees and refunds when
setting a price. Test fulfilment before selling.

## 5. Sourcing: buying the stock on Meesho

The launch catalogue is linked to a supplier called **Meesho (own sourcing)**
(Admin → Suppliers). Nothing is automated through an API, because Meesho does
not publish one — the flow is real, just manual:

1. A paid order creates a supplier order in **Admin → Supplier orders**.
2. Open it: the purchase sheet lists every line with the supplier reference and
   quantity, plus the delivery address to paste into Meesho.
3. Buy the item in the Meesho app, then record the courier and tracking number
   on the same screen. The customer sees the tracking on their order page and
   gets the shipping email automatically.

Delivery estimates are your own promise. Check actual supplier availability and delivery estimates for each destination before promising dates.

## 6. Instant owner alerts

When a customer submits a UPI reference, the store notifies you twice:

- **Email** through the normal queue (visible in Admin → Messages, retried on
  failure). Sent to the support address in Admin → Settings, or `ADMIN_EMAIL`.
- **Telegram push** if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in the
  host environment. Create a bot with @BotFather, message it once, then read the
  chat id from `https://api.telegram.org/bot<TOKEN>/getUpdates`.

Admin → Payments also shows a standing banner with the number of references
waiting for verification, so nothing gets forgotten during a busy day.

## 7. Deploying changes

- Push to `main`. CI runs typecheck, lint, tests and a release build against a
  throw-away PostgreSQL service; the host then deploys.
- The release build applies pending Prisma migrations (`prisma migrate deploy`).
  Never edit an applied migration — add a new one.
- Payment configuration changed? Nothing to redeploy: change the UPI ID in
  Admin → Settings.

## 8. Honest limits

- UPI money is confirmed by you, not by software. The store never marks a UPI
  order paid automatically, and there is no webhook.
- Refunds are manual. There is no API to reverse a UPI transfer.
- The catalogue's visuals are studio renders we generated, and the
  storefront says so in the footer and in every image's alt text. Replace them
  with real photographs of the actual stock as soon as you have them — a render
  is an illustration, not evidence of what arrived.
- Meesho fulfilment is manual by nature. The panel never reports a supplier
  status it did not receive from you.
