# SEO, indexing and search visibility

Everything below is implemented **in code** and verified against the running
build. Nothing here is a "to-do"; the items in *Owner actions* are the only
steps that need a Google/Bing account or a domain.

Live host: `https://aurevynstore.vercel.app` (set `APP_URL` to the real domain
the moment a custom domain is attached — every canonical, sitemap entry and
structured-data URL is derived from it).

---

## 1. What the code already does

| # | Requirement | Where it lives | Notes |
| - | ----------- | -------------- | ----- |
| 1 | `sitemap.xml` | `src/app/sitemap.ts` | Served at `/sitemap.xml`. Static routes + every active category + every **published, priced** product (max 5000). `lastModified` comes from the row's `updatedAt`. Uses the same eligibility predicate as the storefront (`SITEMAP_PRODUCT_WHERE`) so the sitemap can never advertise a page the shop hides. |
| 2 | `robots.txt` | `src/app/robots.ts` | Served at `/robots.txt`. Allows `/`, disallows `/api/`, `/account`, `/admin`, `/checkout`, `/auth/`, `/order/`, and declares the sitemap + host. |
| 3 | Remove `noindex` | — | No public route sets `noindex`. Only `/search` is `index:false, follow:true` (result pages are user-generated duplicates), and `/admin`, `/account` get `X-Robots-Tag: noindex` headers because they are session-gated. |
| 4 | Canonical tags | every indexable page | Home, shop, product, category, about, contact, faq, cart, wishlist, track and all four policies set `alternates.canonical`. Product/category canonicals use the **slug from the database**, never the raw URL segment. |
| 5 | Meta titles | root layout + per page | `title.template = "%s \| {storeName}"`; homepage uses the store tagline; products prefer `seoTitle`, categories prefer `seoTitle`. |
| 6 | Meta descriptions | root layout + per page | Products prefer `seoDescription`, then `shortDescription`, then a 155-char description slice; categories fall back to description then a generated line. |
| 7 | One `<h1>` per page | all routes | Each route renders exactly one `<h1>`. Conditional branches (empty cart, COD vs prepaid confirmation) are mutually exclusive, so only one is ever in the DOM. Admin, account and policy pages inherit one `<h1>` from their layout component. |
| 8 | Heading hierarchy | all routes | `<h1>` → `<h2>` for sections → `<h3>` for cards. No skipped levels: section headers are `<h2>`, cards inside them are `<h3>`. |
| 9 | Alt text | `RemoteImage` call sites | Product images use `image.alt` when the owner supplied it, otherwise the product name. Decorative layers (grain, aura, rules) are `aria-hidden` with no `<img>`. |
| 10 | Schema markup | layout, product, category, shop, FAQ | `Organization` + `WebSite` + `SearchAction` site-wide; `Product` + `Offer`/`AggregateOffer` + `BreadcrumbList` on product pages; `CollectionPage` + `ItemList` on category pages; `ItemList` on `/shop`; `FAQPage` on `/faq`. `AggregateRating` is emitted **only** when real published reviews exist. All JSON-LD passes through `jsonLdScript()` which escapes `<`, `>` and `&` (stored-XSS safe). |
| 11 | Internal links | header, footer, breadcrumbs, product pages | Breadcrumb chain on every product/category, "related products", category links, footer policy/shop links, in-copy links on the home manifesto. |
| 12 | Broken links | verified | A route-vs-`href` scan across `src/` reports **zero** dead internal links (only `/api/health`, which is a real route handler). |
| 13 | Image weight | `next.config.mjs` + `RemoteImage` | Optimizer serves AVIF then WebP; each catalogue photo in `public/products/` is already ≤ 124 KB (total 676 KB for 11 products). Uploaded images are size-checked at upload time. |
| 14 | Core Web Vitals | layout, CSS | Hero image is `priority` (LCP candidate), fonts are self-hosted (no third-party round trip), no layout-shifting banners (heights are fixed), animations are transform/opacity only and respect `prefers-reduced-motion`, and the `.js` reveal class is set before first paint so nothing ships at `opacity:0`. |
| 15 | Mobile | layout + Tailwind | `viewport` sets `width=device-width, initial-scale=1`; every page is mobile-first, tap targets are ≥ 44 px, and the product page has a sticky mobile buy bar. |
| 16 | HTTPS | `next.config.mjs`, `src/middleware.ts` | Production builds send `Strict-Transport-Security: max-age=63072000; includeSubDomains` plus CSP `upgrade-insecure-requests`. Vercel serves HTTPS-only and redirects the `http://` origin automatically; an attached custom domain gets its own certificate. |
| 16a | **Canonical origin cannot go stale** | `src/lib/site-url.ts`, `src/lib/env.ts` | `APP_URL` is resolved once at load. If it is still a `*.vercel.app` host and Vercel reports a different `VERCEL_PROJECT_PRODUCTION_URL`, the injected production host wins. A hand-set custom domain in `APP_URL` is always respected. This exists because the store was renamed and `APP_URL` kept pointing at `zenvorastore.vercel.app`, which returned `DEPLOYMENT_NOT_FOUND`: every canonical and sitemap entry pointed at a dead origin, which is enough on its own to keep a site out of Google. |
| 17 | Clean URL slugs | `slugify()` in `src/lib/utils.ts` | Lowercase, NFKD-normalised, accents stripped, non-alphanumerics collapsed to single hyphens, 80-char cap. Slugs are unique per table. |
| 18 | OG image | `public/og-image.png` + `src/lib/seo/og.ts` | 1200×630 branded PNG (52–90 KB), declared as the default `openGraph.images` and `twitter.images` in the root layout, and re-declared on every page that overrides `openGraph` (about + 4 policies). Product pages use the real product photo instead. Regenerate with `npm run og:image`. |
| 19 | Search Console | layout `verification` | Set `GOOGLE_SITE_VERIFICATION` (and optionally `BING_SITE_VERIFICATION`) in the environment and the ownership meta tag is emitted automatically. Absent → no tag, so nothing is ever falsely claimed. |
| 20 | Backlink strategy | this document, §3 | Backlinks are earned off-site; the code side (crawlable, canonical, fast, structured) is done. |

Additional crawl hygiene that is already in place:

- `/search` is `noindex, follow` (infinite user-generated duplicate URLs).
- **Preview deployments are never indexed**: `robots.txt` returns `Disallow: /`,
  page metadata is `noindex, nofollow`, and middleware sends
  `X-Robots-Tag: noindex, nofollow` (`src/lib/site-indexing.ts`). A preview
  hostname renders the whole store, so indexing one would publish a duplicate
  that competes with the real domain.
- Guest order pages are `noindex` and disallowed in `robots.txt` — they contain
  personal data and are reachable only with an order number + email.
- Soft 404s are impossible: `generateMetadata` calls `notFound()` for missing
  products and categories, so the response is a real 404.
- `poweredByHeader: false` and no source maps in production.

---

## 1a. The origin rule (read this before debugging "Google isn't showing my site")

Every absolute URL the crawler sees — `<link rel="canonical">`, `og:url`,
`sitemap.xml`, `robots.txt` `Host`/`Sitemap`, and JSON-LD `url` — is built from
**the host that actually served the request** (`src/lib/site-origin.ts` +
`originFromHeaders()` in `src/lib/site-url.ts`). A page therefore cannot
advertise a host other than the one that answered 200, which is what makes a
domain move a DNS/`APP_URL` change instead of a code change.

The `Host` header is attacker-controlled, so it is validated against a strict
hostname/port pattern and anything unexpected falls back to `env.APP_URL` —
host-header injection cannot write an arbitrary canonical.

`env.APP_URL` is resolved once at load (`resolvePublicOrigin()`):

1. `APP_URL` that is **not** a `*.vercel.app` host → used as-is (you attached a
   custom domain on purpose).
2. Vercel's injected `VERCEL_PROJECT_PRODUCTION_URL` → used when `APP_URL` is a
   `*.vercel.app` host that no longer matches it.
3. `APP_URL` as configured → local dev, tests, self-hosting.

How to confirm production is right:

```bash
curl -s https://YOUR-HOST/ | grep -o '<link rel="canonical"[^>]*>'
curl -s https://YOUR-HOST/sitemap.xml | head -5
curl -s https://YOUR-HOST/robots.txt
```

All three must name the **same host that answers 200**. A canonical pointing at
a host that returns `DEPLOYMENT_NOT_FOUND` is not a warning; it tells Google the
real page lives somewhere that does not exist, and the page is dropped.

---

## 2. Owner actions (only you can do these)

1. **Attach the domain.** Add it in Vercel → Settings → Domains (records in
   Cloudflare, DNS-only), then set `APP_URL=https://yourdomain.com` in Vercel →
   Settings → Environment Variables (**Production** scope) and redeploy. Canonicals
   follow the request host automatically; `APP_URL` covers emails, reset links and
   webhooks. Step-by-step: `docs/DOMAIN_SETUP.md`.
2. **Verify in Google Search Console.**
   - Either use the **DNS TXT** record (survives redeploys, no code involved), or
   - paste the HTML-tag `content` value into `GOOGLE_SITE_VERIFICATION` and redeploy.
3. **Submit the sitemap** at `https://yourdomain.com/sitemap.xml`
   (Search Console → Sitemaps).
4. **Request indexing** for `/`, `/shop`, and each live product once.
5. Do the same in **Bing Webmaster Tools** (`BING_SITE_VERIFICATION`), which also
   feeds DuckDuckGo and several AI answer engines.
6. Keep `robots.txt` reachable — never put it behind auth or a WAF challenge.

### Verifying it worked

```bash
curl -s https://yourdomain.com/robots.txt
curl -s https://yourdomain.com/sitemap.xml | head -40
curl -sI https://yourdomain.com | grep -i strict-transport
curl -s https://yourdomain.com/ | grep -o '<link rel="canonical"[^>]*>'
```

Then: Search Console → **Pages** (indexed vs. excluded), **Core Web Vitals**,
and the Rich Results Test for a product URL (Product + Breadcrumb should pass).

---

## 3. Backlink strategy (the part software cannot do)

Search engines rank *pages*, and a brand-new store has no authority. In rough
order of effort-to-reward for an Indian D2C store:

1. **Google Business Profile** — only if you have a real, verifiable business
   address. This is the single highest-value citation for local "near me"
   queries. Never invent an address.
2. **Marketplace/storefront cross-links** — your Instagram bio, WhatsApp
   Business catalogue, Facebook Page shop, Meesho/other reseller profiles,
   YouTube channel description. All are `nofollow` but they drive real traffic
   and brand searches, which Google does count.
3. **Supplier and partner pages** — ask each supplier/fulfilment partner for a
   "where to buy" listing; these are relevant, topically adjacent links.
4. **Local and niche directories** — Indian startup/D2C directories, product
   discovery sites, and category-relevant blogs. Choose ones with human review;
   avoid any "1000 backlinks for ₹500" service (that is a penalty risk, not SEO).
5. **Content that earns links** — one honest, genuinely useful page per money
   category (buying guide, size/fit guide, "how we price" transparency page).
   This store already has the raw material: the pricing engine and the verified
   review policy are real, defensible stories.
6. **PR/press** — local news, founder interviews, small-business features. One
   real article beats fifty directory entries.
7. **Customer-generated links** — a review request email that points to the
   product page (not the homepage) so shares and forum mentions land on a
   crawlable URL.

Rules of thumb:

- Relevance > volume. Ten links from Indian retail/lifestyle sites beat 500 from
  unrelated link farms.
- Never buy links, never use PBNs, never cloak. Recovery from a manual action
  costs far more than the links were worth.
- Track with Search Console → Links, and watch impressions (not just clicks) —
  impressions rising is the earliest signal that authority is building.

---

## 4. What was intentionally NOT done

- **No fake reviews, ratings, prices or `AggregateRating`** — Google treats
  invented review markup as spam, and it is dishonest to the customer.
- **No keyword stuffing or doorway pages** — category pages are real, distinct
  pages generated from real categories only.
- **No hreflang** — the store is single-language (English UI). Adding hreflang
  without translated pages creates conflicting signals.
- **No `noindex` removal on `/admin`, `/account`, `/checkout`** — those must stay
  out of the index; "removing noindex" applies to public pages, which never had
  it.
