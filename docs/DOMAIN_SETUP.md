# Domain, DNS, `APP_URL`, Neon branches and Preview vs Production

Owner guide for putting the store on a real domain and keeping the two
environments (Preview / Production) from stepping on each other.

**Short version (অসমীয়াত):** domain আপুনি DigitalPlat-ৰ পৰা ল'ব — মই আপোনাৰ
account/KYC কৰিব নোৱাৰো। Domain লোৱাৰ পিছত Cloudflare-ত DNS দিব, Vercel-ত
custom domain add কৰিব, `APP_URL` = নতুন domain দি **Redeploy** কৰিব। Neon-ত
`production` (parent) আৰু `preview` (child branch) ৰখীয়া — Vercel-ত Production
scope-ত production URL, Preview scope-ত preview URL; দুয়োখন একে scope-ত কেতিয়াও
নিদিব। তাৰ পিছত §9 ৰ `curl` কেইটা চলাই নিজেই verify কৰিব।

---

## 0. What the code already handles (so you know what you must NOT set)

| Behaviour | Where | Consequence for you |
| --- | --- | --- |
| Canonical, `og:url`, sitemap, `robots.txt` `Host`/`Sitemap` and JSON-LD `url` are built from **the request's own host** | `src/lib/site-origin.ts`, `src/lib/site-url.ts` | The moment DNS + Vercel answer on the new domain, those tags name the new domain. No code change is needed to "switch" the SEO host. |
| A `*.vercel.app` `APP_URL` is ignored when Vercel reports a different production host | `src/lib/env.ts` | A stale env value cannot poison canonicals again (this is what broke indexation before). |
| A **non**-`*.vercel.app` `APP_URL` is always respected | `src/lib/site-url.ts` | After you set `APP_URL=https://your.domain`, out-of-request URLs (emails, reset links, webhooks, admin links) use it. |
| Preview deployments are `noindex, nofollow` + `Disallow: /` + `X-Robots-Tag` | `src/lib/site-indexing.ts`, `src/app/robots.ts`, `src/app/layout.tsx`, `src/middleware.ts` | A preview can never be indexed as a duplicate of the real store. |

`APP_URL` is still **required in Production** — not for canonicals, but for
everything generated outside a request: password-reset links, order/tracking
links in emails, owner Telegram/email alerts, and the supplier webhook URL.
If it points at `localhost` or the old host, those links are broken even though
the storefront looks fine.

---

## 1. Get the domain (DigitalPlat FreeDomain — free subdomain)

You must do this yourself; it needs your identity, not code.

1. `https://dash.domain.digitalplat.org` → **Sign up** → username, **real** name,
   email, phone, address, password. Confirm from the email they send.
2. **Verification/KYC** — whatever the dashboard asks (usually linking a GitHub
   account). This is a real identity check; do not use invented details.
3. **Domains → Get a new domain** → type a name, choose a suffix → **Check
   availability** → continue only on "Free Domain available".
   - `.dpdns.org` and `.qzz.io` are the free suffixes. `.us.kg` / `.xx.kg` now
     want a paid slot — do not pay anything for a "free" domain.
4. Paste the **two nameservers Cloudflare gives you** (§2), choose the free slot,
   **Register**. The domain + expiry appear under **My Domains**.
5. **Renewal**: free renewal via domain → **Renew** → *Request free renewal*,
   available while more than **120 days** remain. Put a calendar reminder ~150
   days before expiry — if it lapses, the hostname is gone and can be taken by
   someone else.

Honest limits of a free subdomain (they matter for a shop):

- You do not own it. There is no SLA, and the provider can suspend it (spam,
  phishing, false registration data are the stated reasons). Register with true
  information and keep the policies.
- Anyone can see it is a free subdomain; some customers and some directories
  treat that as lower trust. It is fine to launch, but budget for a paid
  `.in`/`.com` later and keep the same code — only DNS and `APP_URL` change.
- Do **not** buy "extra slots" from Telegram/DM offers. Fake. Only the official
  dashboard (`dash.domain.digitalplat.org`) and
  `github.com/DigitalPlatDev/FreeDomain` are real.
- Keep `https://<project>.vercel.app` working as a fallback. Never let the only
  copy of your catalogue live behind a hostname you do not control.

---

## 2. Cloudflare (free DNS)

1. `https://dash.cloudflare.com` → **Add a domain** → the full domain
   (`yourname.dpdns.org`) → **Free** plan.
2. Cloudflare shows **two nameservers** (e.g. `xxx.ns.cloudflare.com`). Copy
   them exactly into DigitalPlat → domain → **Nameservers** (or paste them during
   registration in §1.4).
3. Wait. Cloudflare shows **Active** once it has seen the nameservers (minutes to
   a few hours). Do not create records before the zone is active — nothing will
   resolve.

---

## 3. Point the domain at Vercel

1. Vercel → your project → **Settings → Domains → Add** → type the domain.
2. Vercel prints the **exact** records it wants. Use those, not numbers from a
   blog post or this document — Vercel changes them per project and over time.
   Typical shape:
   - apex/root (`yourname.dpdns.org`): either an `A` record to Vercel's IP, or a
     `CNAME` to `cname.vercel-dns.com` (Cloudflare flattens CNAME at the apex,
     so this works).
   - `www`: `CNAME` → `cname.vercel-dns.com`.
3. In Cloudflare → **DNS → Records**, add each record. **Proxy status: DNS only
   (grey cloud)** while Vercel issues the certificate. Proxying before that is
   the usual cause of "Invalid Configuration" loops; you can enable the orange
   cloud later with SSL mode **Full (strict)**, but DNS-only is the configuration
   Vercel supports without caveats.
4. Back in Vercel → wait for **Valid Configuration**; the TLS certificate is
   issued automatically (Let's Encrypt, minutes). Set the domain as **Primary**
   so the other hostnames redirect to it.
5. Optional but recommended: Google Search Console → add the domain via a **DNS
   TXT** record (`_google-site-verification=…`) in Cloudflare. It survives every
   redeploy and needs no code. The HTML-tag alternative is
   `GOOGLE_SITE_VERIFICATION` (§5).

### Email records (only when you turn on SMTP)

If you later send mail as `no-reply@yourname.dpdns.org`, publish the SPF/DKIM
records your SMTP provider (Resend/Brevo/SES/Zoho) gives you, plus
`_dmarc` (`v=DMARC1; p=none; rua=mailto:you@yourdomain`). Until then keep
`EMAIL_PROVIDER=console` — it honestly records "not sent" instead of silently
failing.

---

## 4. Set `APP_URL` and redeploy

Vercel → **Settings → Environment Variables**:

| Variable | Scope | Value |
| --- | --- | --- |
| `APP_URL` | **Production** | `https://yourname.dpdns.org` |
| `APP_URL` | **Preview** | leave as the preview/`*.vercel.app` host, or set per-branch |
| `APP_URL` | Development | `http://localhost:3000` (in `.env.local`) |

Then **Deployments → ⋯ → Redeploy** (an env change does not apply to an existing
deployment). Only after a successful build do emails, reset links and webhooks
use the new domain.

Do **not** add a trailing slash. Do **not** use `http://`.

---

## 5. Neon: parent branch and child branch

Neon vocabulary that the docs and the build logs use:

- **Project** — one Postgres cluster (`soft-snow-22386582`).
- **Branch (parent)** — a copy-on-write database with its own endpoint host and
  connection string. `main` (sometimes named `production`) is the parent that
  serves real customers.
- **Child branch** — forked *from* a parent. It starts as an exact copy of the
  parent's data at fork time, then diverges. Nothing you do on a child touches
  the parent. This is the correct place for Preview builds and for rehearsing a
  migration or a restore.

Setup:

1. Neon console → project → **Branches** → **New branch**:
   - name `preview`
   - **parent**: the production branch (`main`)
   - **include data**: yes if you want realistic previews (it is a copy of real
     orders/customers — see the warning in §7), or schema-only if you prefer
     empty previews.
2. Open the `preview` branch → **Connection details** → copy **both** strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `DIRECT_URL`
3. Vercel → Environment Variables, and scope strictly:

| Variable | Production scope | Preview scope |
| --- | --- | --- |
| `DATABASE_URL` | pooled URL of the **production** branch | pooled URL of the **preview** branch |
| `DIRECT_URL` | direct URL of the **same production** branch | direct URL of the **same preview** branch |

A single row ticked for **both** Production and Preview is a misconfiguration —
split it into two rows. The release pipeline refuses to build when the pooled and
direct hosts disagree, and refuses to run a Preview migration against a database
already claimed by Production (`scripts/release.ts`, `deployment_environment`
marker). So a mistake fails the build instead of corrupting data.

Housekeeping:

- Set the preview branch to **scale to zero** (autosuspend) so it costs nothing
  while idle.
- Reset/refresh the preview branch from production whenever you want a clean
  rehearsal: Neon → Branches → `preview` → **Reset from parent**.
- The **Neon ↔ Vercel integration** can create one branch per preview deployment
  automatically and inject `DATABASE_URL`. If you use it, let it own the Preview
  scope variables and do not also hand-set them. A forked branch is recognised as
  a fork (different endpoint host) and re-claimed as Preview, so no flag is
  needed. `RELEASE_RECLAIM_DATABASE=1` exists only for deliberately moving a
  database between environments — use it once, then delete it.

---

## 6. Preview vs Production at a glance

| | Preview | Production |
| --- | --- | --- |
| Trigger | every non-`main` branch / PR | push to `main` |
| URL | `<project>-git-<branch>-<team>.vercel.app` or per-deployment id | `https://yourname.dpdns.org` (+ `*.vercel.app` redirect) |
| Database | Neon **preview** child branch | Neon **production** parent branch |
| Indexable | **No** — `noindex, nofollow`, `Disallow: /`, `X-Robots-Tag`, and not in any sitemap | Yes |
| `APP_URL` scope | Preview value | `https://yourname.dpdns.org` |
| Test payments / demo supplier (`PAYMENTS_TEST_MODE`, `SUPPLIER_DEMO_MODE`) | allowed | forced off in code even if set |
| Cron (`vercel.json`) | not scheduled | scheduled, `Authorization: Bearer $CRON_SECRET` |
| Purpose | click through a change before merging | real customers, real money |

---

## 7. Preview deployments are public — protect them if the branch has real data

A preview hostname needs no login to view unless you enable protection, and a
preview forked from production contains real customer rows. Turn on Vercel →
**Settings → Deployment Protection → Vercel Authentication** (at least for
Preview), or use the schema-only fork in §5.1. Never paste a preview URL into a
public post while it holds customer data.

---

## 8. Cloudflare Pages / Netlify / GitHub Pages

This project is a **Next.js app with a server, a database and background jobs**
— it is not a static export. GitHub Pages and a plain Cloudflare Pages static
upload cannot run it; Vercel (or another Node host) is required. If you ever host
a *separate* static client/marketing site, use a subdomain per client
(`client1.yourname.dpdns.org`) and add that record in Cloudflare — that is fine,
but it is a different project, not this store.

---

## 9. Verify the domain end to end (run these yourself)

```bash
# 1. DNS reaches Vercel
dig +short yourname.dpdns.org
dig +short www.yourname.dpdns.org

# 2. TLS + headers
curl -sI https://yourname.dpdns.org | grep -iE "^HTTP|strict-transport|content-security"

# 3. Canonical names the new domain (not the old *.vercel.app)
curl -s https://yourname.dpdns.org/ | grep -o '<link rel="canonical"[^>]*>'

# 4. robots + sitemap name the same host, and the sitemap URLs resolve
curl -s https://yourname.dpdns.org/robots.txt
curl -s https://yourname.dpdns.org/sitemap.xml | head -5

# 5. App is alive and the database is reachable
curl -s https://yourname.dpdns.org/api/health

# 6. Protection still works
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://yourname.dpdns.org/api/cron/jobs   # 401
curl -s -o /dev/null -w "%{http_code}\n" https://yourname.dpdns.org/admin                   # 307

# 7. A preview must NOT be indexable
curl -s https://<preview-url>/robots.txt        # Disallow: /
curl -sI https://<preview-url>/ | grep -i x-robots-tag   # noindex, nofollow
```

All of 1–7 must pass before you submit the sitemap to Google.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `DEPLOYMENT_NOT_FOUND` on an old host | the deployment that owned that alias is gone, or the name was retired | remove it from Vercel → Domains; make sure `APP_URL` and any bookmark point at the live domain |
| `402 DEPLOYMENT_DISABLED` | that Vercel project is disabled/paused | ignore it, or delete the project so it cannot be mistaken for the store |
| Vercel says **Invalid Configuration** forever | records not added, or Cloudflare proxy is on before the cert exists | add exactly the records Vercel shows, set **DNS only** (grey cloud), wait for propagation |
| Certificate stuck "pending" | apex still proxied, or a stale A record at another provider | remove foreign A/AAAA records for the apex; keep only Vercel's |
| Redirect loop / 522 | Cloudflare proxy with the wrong SSL mode | grey cloud (DNS only) first; if you re-enable proxy use **Full (strict)** |
| Canonical still shows `*.vercel.app` | the deployment predates the domain, or `APP_URL` was changed without a redeploy | redeploy; re-run §9.3 |
| Wrong host in emails / reset links | `APP_URL` still old or set only for Preview | set it in **Production** scope and redeploy |
| Preview appears in Google | a preview from before the noindex change | redeploy that branch, then Search Console → Removals for the preview URL |
| Build fails: "database claimed by production/preview" | `DATABASE_URL`/`DIRECT_URL` scoped to the wrong Vercel environment | fix the scope per §5.3, redeploy; do not set `RELEASE_RECLAIM_DATABASE` to force it |
| Build fails: pooled and direct hosts differ | one URL copied from another branch/project | copy both strings from the **same** Neon branch |
| Store loads but pages 500 | database unreachable from the new env scope | `/api/health` → `database:false`; check the Neon branch is not suspended and the password is current |

---

## 11. Who does what

| Step | Who |
| --- | --- |
| Register/KYC the domain, renew it | **You only** (identity + dashboard) |
| Cloudflare nameservers and DNS records | **You only** (dashboard) |
| Add the domain in Vercel, set primary, redeploy | **You only** (dashboard access) |
| Set `APP_URL`, per-environment DB URLs, secrets | **You only** (Vercel env UI — never paste secrets in chat) |
| Create the Neon parent/child branches and copy their URLs | **You only** |
| Code: request-derived canonicals, stale-env protection, preview noindex, route verification, docs | Done in this repo |
| Submit sitemap, request indexing, Search Console/Bing | **You only** |

Nothing here is "production-ready" merely because the code exists: the store is
live on the domain only after §9 passes on the real hostname.
