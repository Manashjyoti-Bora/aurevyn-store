import Link from 'next/link';
import Image from '@/components/ui/remote-image';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';

/* Title/description/OG inherit the root layout defaults; the homepage only
   needs its self-referencing canonical (every other indexable route already
   declares one; utility/PII routes are noindex). */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};
import {
  getFeaturedProducts,
  getNewArrivals,
  getSaleProducts,
  listActiveCategories,
} from '@/lib/catalog/storefront';
import { prisma } from '@/lib/db';
import { loadPaymentStatus } from '@/lib/payments';
import { ProductGrid } from '@/components/store/product-grid';
import { LinkButton } from '@/components/ui/button';
import { formatINR } from '@/lib/money';
import { DemoExplainer } from '@/components/store/demo-explainer';
import { Reveal } from '@/components/store/reveal';
import { HeroPanel } from '@/components/store/hero-panel';
import { Marquee } from '@/components/store/marquee';
import { AuraCursor } from '@/components/store/aura-cursor';
import { ChapterRail } from '@/components/store/chapter-rail';
import { Fracture } from '@/components/store/fracture';
import { CustomerVoices } from '@/components/store/customer-voices';

export const dynamic = 'force-dynamic';

/* Inline icon set — drawn for Nirvora, no emoji, no icon dependency. */
function TruckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 6.5A1.5 1.5 0 0 1 3.5 5h9A1.5 1.5 0 0 1 14 6.5V15H2V6.5Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 8.5h3.9c.5 0 .96.25 1.23.67l2.3 3.5c.17.26.27.57.27.88V15h-7.7"
      />
      <circle cx="6.5" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}
function LockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden="true"
    >
      <rect x="5" y="10.5" width="14" height="9" rx="2" />
      <path strokeLinecap="round" d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
function ReturnIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h11a5 5 0 0 1 0 10h-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 5.5 4 9l3.5 3.5" />
    </svg>
  );
}
function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function SectionHeader({
  id,
  index,
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  id: string;
  index: string;
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4 border-b border-white/[0.07] pb-4">
      <div className="flex min-w-0 items-baseline gap-4">
        <span
          className="hidden shrink-0 text-[11px] tabular-nums tracking-[0.2em] text-accent-500/70 sm:block"
          aria-hidden="true"
        >
          {index}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-accent-400">
            {eyebrow}
          </p>
          <h2
            id={id}
            className="mt-1.5 truncate text-2xl font-normal tracking-[-0.03em] text-ink-900 sm:text-[2rem]"
          >
            {title}
          </h2>
        </div>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="link-underline group inline-flex shrink-0 items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500 transition-colors hover:text-ink-900 sm:text-[11px]"
        >
          {linkLabel}
          <span className="sr-only"> {title}</span>
          <ArrowIcon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const [settings, categories, featured, newest, deals, activeCount, payments] = await Promise.all([
    getSettings(),
    listActiveCategories(),
    getFeaturedProducts(8),
    getNewArrivals(8),
    getSaleProducts(8),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    loadPaymentStatus(),
  ]);

  const onlineLabel =
    payments.kind === 'UPI'
      ? 'via UPI QR'
      : payments.kind === 'TEST'
        ? 'TEST mode — no real money moves'
        : 'being configured';
  const codLabel = settings.shipping.codEnabled ? ' + Cash on Delivery' : '';
  const heroProduct = featured.find((p) => p.imageUrls.length > 0) ?? null;

  const shippingLine =
    settings.shipping.freeAbovePaise > 0
      ? `Free shipping above ${formatINR(settings.shipping.freeAbovePaise)}`
      : 'Pan-India shipping';
  const returnsLine =
    settings.policies.returnWindowDays > 0
      ? `${settings.policies.returnWindowDays}-day returns`
      : 'See returns policy';

  return (
    <>
      {/* Fixed editorial index — rendered outside the hero so it is never
          clipped by the section's overflow/stacking context. */}
      <ChapterRail
        chapters={[
          { id: 'shop-by-category', label: 'Index' },
          { id: 'deals', label: 'Deals' },
          { id: 'featured-products', label: 'Featured' },
          { id: 'new-arrivals', label: 'New in' },
          { id: 'how-it-works', label: 'Practice' },
        ]}
      />

      {/* ══════════════ HERO — obsidian stage, porcelain type, one light ══════════════ */}
      <section className="relative isolate overflow-hidden bg-[#060607]">
        {/* Pointer aura — desktop fine-pointer only, transform-only, unmounts
            its listeners once the hero leaves the viewport. */}
        <AuraCursor size={520} />
        {/* Atmosphere: two slow light pools + a hairline grid + film grain. */}
        <div
          className="aura left-[8%] top-[-14%] h-[34rem] w-[34rem] animate-aurora bg-[radial-gradient(circle,rgba(198,173,122,0.16),transparent_68%)]"
          aria-hidden="true"
        />
        <div
          className="aura right-[-6%] top-[16%] h-[30rem] w-[30rem] animate-aurora bg-[radial-gradient(circle,rgba(245,243,236,0.09),transparent_70%)]"
          style={{ animationDelay: '-8s' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(245,243,236,0.05) 0 1px, transparent 1px 25%)',
          }}
        />
        <div className="grain" aria-hidden="true" />

        <div className="container-store relative pb-10 pt-12 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div>
              <div className="inline-flex animate-fade-up items-center gap-3">
                <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                  <span
                    className={`absolute inset-0 rounded-full ${activeCount > 0 ? 'bg-accent-400' : 'bg-ink-300'} animate-pulse-ring`}
                  />
                  <span
                    className={`relative h-1.5 w-1.5 rounded-full ${activeCount > 0 ? 'bg-accent-400' : 'bg-ink-400'}`}
                  />
                </span>
                <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-ink-400">
                  {settings.storeName}
                  <span className="mx-2 text-accent-500" aria-hidden="true">
                    /
                  </span>
                  {activeCount > 0
                    ? `${activeCount} piece${activeCount === 1 ? '' : 's'} live`
                    : 'Atelier — opening soon'}
                </p>
              </div>

              <h1 className="display mt-6 text-[2.6rem] leading-[0.95] text-ink-900 sm:mt-7 sm:text-[3.6rem] lg:text-[4.15rem]">
                {settings.storeTagline ? (
                  <span className="block">{settings.storeTagline}</span>
                ) : (
                  <>
                    <span className="block">Considered objects,</span>
                    <span className="text-sheen block">honestly priced.</span>
                  </>
                )}
              </h1>

              <p className="measure mt-6 max-w-lg text-sm leading-relaxed text-ink-400 sm:text-[15px]">
                A monochrome catalogue of everyday essentials —{' '}
                {settings.tax.pricesIncludeTax
                  ? 'final ₹ prices with tax included'
                  : 'transparent ₹ pricing'}
                , real stock states, and an order you can follow from checkout to doorstep.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <LinkButton href="/shop" size="lg" className="w-full justify-center sm:w-auto">
                  Enter the catalogue
                </LinkButton>
                <Link
                  href="/track"
                  className="link-underline group inline-flex min-h-[44px] items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500 transition-colors hover:text-ink-900"
                >
                  Track an order
                  <ArrowIcon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>

              {/* Fact rail — every line is derived from real store settings. */}
              <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-3">
                {[
                  { icon: <TruckIcon />, k: 'Delivery', v: shippingLine },
                  { icon: <LockIcon />, k: 'Payment', v: `Secure ${onlineLabel}${codLabel}` },
                  { icon: <ReturnIcon />, k: 'Returns', v: returnsLine },
                ].map((item) => (
                  <div key={item.k} className="bg-[#0A0A0C] px-4 py-4">
                    <dt className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.24em] text-accent-500/80">
                      <span className="text-accent-400">{item.icon}</span>
                      {item.k}
                    </dt>
                    <dd className="mt-2 text-[12.5px] leading-snug text-ink-700">{item.v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex items-center gap-3 text-[9px] font-medium uppercase tracking-[0.3em] text-ink-300">
                <span className="scroll-cue" aria-hidden="true" />
                Scroll to browse
              </div>
            </div>

            {/* Right plate: the real featured product, framed like a vitrine. */}
            <div
              className="animate-fade-up lg:justify-self-end"
              style={{ animationDelay: '120ms' }}
            >
              <HeroPanel>
                {heroProduct ? (
                  <div className="relative mx-auto w-full max-w-[24rem]">
                    <span
                      className="pointer-events-none absolute -left-3 -top-3 h-8 w-8 border-l border-t border-accent-400/50"
                      aria-hidden="true"
                    />
                    <span
                      className="pointer-events-none absolute -bottom-3 -right-3 h-8 w-8 border-b border-r border-accent-400/50"
                      aria-hidden="true"
                    />

                    <Link
                      href={`/products/${heroProduct.slug}`}
                      className="lux-frame group block rounded-[1.6rem] bg-cream-100 p-2.5 shadow-[0_60px_120px_-60px_rgba(0,0,0,1)] transition-transform duration-500 ease-zenvora [@media(hover:hover)]:hover:-translate-y-1"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.2rem] bg-cream-200">
                        <Image
                          src={heroProduct.imageUrls[0]}
                          alt={heroProduct.imageAlt || heroProduct.name}
                          fill
                          sizes="(max-width: 1024px) 80vw, 380px"
                          className="object-cover transition-transform duration-[1100ms] ease-zenvora [@media(hover:hover)]:group-hover:scale-[1.05]"
                          priority
                        />
                        <div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
                          aria-hidden="true"
                        />
                        {heroProduct.compareAtPricePaise != null &&
                          heroProduct.compareAtPricePaise > heroProduct.pricePaise && (
                            <span className="absolute left-3 top-3 rounded-full bg-accent-400 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream-50">
                              On sale
                            </span>
                          )}
                      </div>

                      <div className="flex items-end justify-between gap-3 px-2 pb-1 pt-3.5">
                        <div className="min-w-0">
                          <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-accent-400">
                            Featured selection
                          </p>
                          <p className="mt-1.5 truncate text-[13px] text-ink-900">
                            {heroProduct.name}
                          </p>
                        </div>
                        <p className="shrink-0 text-[13px] font-medium tabular-nums text-ink-900">
                          {formatINR(heroProduct.pricePaise)}
                        </p>
                      </div>
                    </Link>

                    <div className="mt-5 flex items-center justify-between gap-4 px-1">
                      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">
                        {heroProduct.categoryName ?? 'Catalogue'}
                      </p>
                      <Link
                        href={`/products/${heroProduct.slug}`}
                        className="link-underline inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500 hover:text-ink-900"
                      >
                        View piece
                        <ArrowIcon className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="lux-frame relative mx-auto w-full max-w-md rounded-[1.6rem] bg-cream-100/80 p-5 shadow-[0_50px_100px_-60px_rgba(0,0,0,1)] sm:p-7">
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-cream-50">
                          {settings.storeName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {settings.storeName}
                          </p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-accent-400">
                            Storefront standards
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full border border-accent-400/30 px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-accent-300">
                        INR
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      {[
                        {
                          k: 'Pricing',
                          v: settings.tax.pricesIncludeTax
                            ? 'GST-inclusive ₹'
                            : 'INR + GST at checkout',
                        },
                        {
                          k: 'Dispatch ETA',
                          v: `${settings.shipping.estimatedDaysMin}–${settings.shipping.estimatedDaysMax} business days`,
                        },
                        { k: 'Free shipping', v: shippingLine },
                        { k: 'Returns', v: returnsLine },
                      ].map((row) => (
                        <div key={row.k} className="border-t border-white/[0.08] pt-2.5">
                          <dt className="text-[9px] font-medium uppercase tracking-[0.2em] text-ink-400">
                            {row.k}
                          </dt>
                          <dd className="mt-1.5 text-[12.5px] leading-snug text-ink-800">
                            {row.v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </HeroPanel>
            </div>
          </div>
        </div>

        {/* The utility ticker closes the stage. */}
        <div className="relative border-y border-white/[0.07] bg-[#08080A]">
          <Marquee
            items={[
              'New pieces weekly',
              'Transparent ₹ pricing',
              shippingLine,
              returnsLine,
              'Tracked fulfilment',
              'Secure checkout',
            ]}
            className="py-3"
          />
        </div>
      </section>

      {settings.demoMode && (
        <section className="container-store pt-8 sm:pt-10" id="demo-mode">
          <DemoExplainer activeCount={activeCount} />
        </section>
      )}

      {/* ══════════════ CATEGORIES — editorial index ══════════════ */}
      {categories.length > 0 && (
        <section className="container-store py-12 sm:py-16" aria-labelledby="shop-by-category">
          <Reveal>
            <SectionHeader
              id="shop-by-category"
              index="01"
              eyebrow="Index"
              title="Shop by category"
              href="/shop"
              linkLabel="View all"
            />
          </Reveal>
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="snap-rail sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-0 lg:grid-cols-3">
              {categories.slice(0, 9).map((c, i) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  className="group flex w-56 shrink-0 snap-start items-center justify-between gap-4 border-b border-white/[0.07] py-4 transition-colors hover:border-accent-400/40 sm:w-auto"
                >
                  <span className="flex min-w-0 items-baseline gap-3">
                    <span
                      className="text-[10px] tabular-nums tracking-[0.18em] text-ink-300"
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] text-ink-800 transition-colors group-hover:text-ink-950">
                        {c.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-ink-400">
                        {c.productCount} piece{c.productCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <ArrowIcon className="h-4 w-4 shrink-0 text-ink-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent-400" />
                </Link>
              ))}
            </div>
          </div>
          <Fracture className="mt-10 h-12 sm:h-16" />
        </section>
      )}

      {/* ══════════════ DEALS — only when real discounts exist ══════════════ */}
      {deals.length > 0 && (
        <section
          className="border-y border-white/[0.06] bg-[#0A0A0C] py-12 sm:py-16"
          aria-labelledby="deals"
        >
          <div className="container-store">
            <Reveal>
              <SectionHeader
                id="deals"
                index="02"
                eyebrow="Limited pricing"
                title="Deals right now"
                href="/shop?sort=price-asc"
                linkLabel="Shop all"
              />
              <ProductGrid products={deals} />
            </Reveal>
          </div>
        </section>
      )}

      {/* ══════════════ FEATURED ══════════════ */}
      {featured.length > 0 && (
        <section className="container-store py-12 sm:py-16" aria-labelledby="featured-products">
          <Reveal>
            <SectionHeader
              id="featured-products"
              index="03"
              eyebrow="Selected"
              title="Featured pieces"
              href="/shop?sort=featured"
              linkLabel="See more"
            />
            <ProductGrid products={featured} />
          </Reveal>
        </section>
      )}

      {/* ══════════════ NEW ARRIVALS ══════════════ */}
      {newest.length > 0 && (
        <section className="container-store pb-14 pt-0 sm:pb-20" aria-labelledby="new-arrivals">
          <Reveal delay={60}>
            <SectionHeader
              id="new-arrivals"
              index="04"
              eyebrow="Just in"
              title="New arrivals"
              href="/shop?sort=newest"
              linkLabel="See more"
            />
            <ProductGrid products={newest} />
          </Reveal>
        </section>
      )}

      {/* Empty catalog state — honest, never fake products. */}
      {activeCount === 0 && (
        <section className="container-store py-12 sm:py-16" aria-labelledby="catalog-setup-heading">
          <div className="lux-frame overflow-hidden rounded-3xl bg-cream-100 p-6 sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-400/25 px-3.5 py-1 text-[9px] font-medium uppercase tracking-[0.24em] text-accent-300">
                <span className="h-1 w-1 rounded-full bg-accent-400" aria-hidden="true" />
                Catalogue status · pre-launch
              </span>
              <h2
                id="catalog-setup-heading"
                className="mt-5 text-2xl font-normal tracking-[-0.03em] text-ink-900 sm:text-[2rem]"
              >
                The catalogue is being set up
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-400">
                Pieces appear here the moment the store owner publishes them. If you are the owner,
                log in to add products, sync a supplier catalogue, or import a CSV.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3 sm:gap-6">
                {[
                  {
                    n: '01',
                    t: 'Source',
                    d: 'Sync a dropshipping supplier or upload a product CSV.',
                  },
                  {
                    n: '02',
                    t: 'Price',
                    d: 'Link supplier SKUs with automatic INR margin protection.',
                  },
                  {
                    n: '03',
                    t: 'Publish',
                    d: 'Only products marked ACTIVE appear on the storefront.',
                  },
                ].map((s) => (
                  <div key={s.n} className="border-t border-white/[0.1] pt-3">
                    <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-accent-400">
                      Step {s.n} · {s.t}
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-400">{s.d}</p>
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <LinkButton href="/auth/login" variant="primary" size="md">
                  Owner log in
                </LinkButton>
                <LinkButton href="/admin/products" variant="outline" size="md">
                  Open admin catalogue
                </LinkButton>
                <LinkButton href="/track" variant="ghost" size="md">
                  Track an order
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      )}

      <CustomerVoices />

      {/* ══════════════ MANIFESTO — the atelier's factual promises ══════════════ */}
      <section
        className="relative overflow-hidden border-t border-white/[0.06]"
        aria-labelledby="how-it-works"
      >
        <div className="grain" aria-hidden="true" />
        <div className="container-store py-16 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent-400">
                The practice
              </p>
              <h2
                id="how-it-works"
                className="mt-4 text-[2rem] font-normal leading-[1.02] tracking-[-0.035em] text-ink-900 sm:text-[2.75rem]"
              >
                Four quiet steps,
                <br />
                <span className="text-ink-400">nothing hidden.</span>
              </h2>
              <div className="rule-hair mt-8 max-w-xs" />
            </div>

            <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-2">
              {[
                {
                  n: '01',
                  t: 'Browse & add to cart',
                  d: 'Every ₹ price shown is final and tax-inclusive.',
                },
                {
                  n: '02',
                  t: 'Secure checkout',
                  d: 'Pay by UPI QR from any UPI app, or choose Cash on Delivery where enabled.',
                },
                {
                  n: '03',
                  t: 'We prepare the order',
                  d: 'Confirmed orders are packed and dispatched with our fulfilment partners.',
                },
                {
                  n: '04',
                  t: 'Follow it home',
                  d: 'Track live shipping status with your order number and email.',
                },
              ].map((s) => (
                <li
                  key={s.n}
                  className="group bg-[#0A0A0C] p-5 transition-colors duration-300 hover:bg-[#0E0E11] sm:p-6"
                >
                  <span className="text-[10px] tabular-nums tracking-[0.2em] text-accent-500/80">
                    {s.n}
                  </span>
                  <h3 className="mt-3 text-[15px] font-normal text-ink-900">{s.t}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
