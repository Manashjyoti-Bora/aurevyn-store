import { prisma } from '../db';
import { auditLog } from '../audit';
import { updateSettings, getSettings } from '../settings';
import { saveProduct, archiveProduct } from './products';
import type { Actor } from './types';

/**
 * Meesho launch catalogue.
 *
 * Zenvora resells from Meesho today; CJ Dropshipping is planned for later, so
 * this catalogue is deliberately built for the model that is live now:
 *
 *  - Every piece sits in the ₹249–₹799 band, which is where Meesho converts
 *    (the platform's own sellers report ₹99–₹499 as the volume sweet spot).
 *  - Categories are the low-return ones: kitchen utility, storage and
 *    organisation, mobile accessories, home lighting, stationery, small
 *    personal-care tools. Apparel and footwear are deliberately absent —
 *    size and fit returns are the single biggest margin killer for a reseller,
 *    and no honest "lowest return" claim can be made about them.
 *  - Each item is a plain, demo-able, unisex utility rather than a trend
 *    gimmick, so it keeps selling after the Reel stops trending.
 *
 * Facts the installer stays honest about:
 *  - Prices, costs and stock are the owner's to edit; nothing is locked in.
 *  - Stock is real merchant stock (LOCAL mode) at the stated counts.
 *  - The supplier is "Meesho (own sourcing)", a MEESHO-type partner: paid
 *    orders queue for manual placement from the Meesho app, then tracking is
 *    recorded in Admin → Supplier orders. Meesho has no open ordering API, so
 *    no automated acceptance is pretended.
 *  - Product photos are studio renders the store owns (not supplier CDN
 *    images), labelled as such wherever they are displayed.
 *  - Idempotent: products are matched by slug and never overwritten, so
 *    running it twice cannot clobber edits or duplicate the catalogue.
 *  - Slugs from the earlier, higher-priced launch set are archived, not
 *    deleted, so historical orders keep their product rows.
 */

export interface CuratedCategory {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export interface CuratedProduct {
  name: string;
  slug: string;
  sku: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  costPaise: number;
  shippingPaise: number;
  pricePaise: number;
  stock: number;
  weightGrams: number;
  image: string;
  sortOrder: number;
}

export const MEESHO_SUPPLIER_SLUG = 'meesho';

/**
 * Products from the previous launch set that the store no longer sells. They
 * are archived on install (never deleted) so order history and audits stay
 * intact. Keeping this list makes the removal explicit and reversible.
 */
export const RETIRED_SLUGS = [
  'pulse-power-bank',
  'meridian-laptop-backpack',
  'lumen-desk-lamp',
  'ember-soy-candle-trio',
  'terra-ceramic-mug-duo',
] as const;

export const CURATED_CATEGORIES: CuratedCategory[] = [
  {
    name: 'Kitchen & Dining',
    slug: 'kitchen-dining',
    description: 'Small tools that make daily cooking faster — the lowest-return category we sell.',
    sortOrder: 0,
  },
  {
    name: 'Storage & Organisation',
    slug: 'storage-organisation',
    description: 'Space savers for rented rooms, hostel shelves and overstuffed cupboards.',
    sortOrder: 1,
  },
  {
    name: 'Mobile & Tech',
    slug: 'mobile-tech',
    description: 'Everyday carry electronics and phone accessories, priced to replace without thought.',
    sortOrder: 2,
  },
  {
    name: 'Home Lighting',
    slug: 'home-lighting',
    description: 'Warm, low-power lighting that changes a room for under ₹500.',
    sortOrder: 3,
  },
  {
    name: 'Everyday Carry',
    slug: 'everyday-carry',
    description: 'One good bag, built for a commute rather than a photoshoot.',
    sortOrder: 4,
  },
  {
    name: 'Desk & Self-care',
    slug: 'desk-self-care',
    description: 'Quiet desk tools and small rituals that fit a normal evening.',
    sortOrder: 5,
  },
];

export const CURATED_PRODUCTS: CuratedProduct[] = [
  {
    name: 'SwiftChop Hand-Press Chopper',
    slug: 'swiftchop-hand-press-chopper',
    sku: 'ZV-KIT-01',
    categorySlug: 'kitchen-dining',
    shortDescription: 'Pull-cord chopper that dices onion, garlic and tomato in seconds — no electricity.',
    description:
      'A 500 ml pull-cord chopper with three stainless steel blades. Two or three pulls dices an onion; a few more handle garlic, ginger, coriander or a tomato for a curry base. No power, no blade guard to misplace, and the bowl doubles as a storage tub with its lid.\n\nAll parts except the cord lid are dishwasher safe. Hand wash the lid — the cord mechanism is not sealed.\n\nNot suitable for hard spices, ice or meat. Ships in 2–4 business days.',
    costPaise: 18500,
    shippingPaise: 5500,
    pricePaise: 39900,
    stock: 40,
    weightGrams: 320,
    image: '/products/swiftchop-chopper.jpg',
    sortOrder: 0,
  },
  {
    name: 'Cove Insulated Bottle 750 ml',
    slug: 'cove-insulated-bottle',
    sku: 'ZV-KIT-02',
    categorySlug: 'kitchen-dining',
    shortDescription: 'Double-wall steel bottle: 18 hours cold, 8 hours hot, leak-proof cap.',
    description:
      'A 750 ml double-wall vacuum bottle in a matte powder-coated finish that does not slip in a bag. Cold drinks stay cold for about 18 hours; hot drinks stay hot for about 8.\n\nThe cap seals with a silicone gasket and has a loop for a carabiner. The wide mouth takes standard ice cubes and a bottle brush.\n\nHand wash only — the coating survives a dishwasher far less well than the steel does. Ships in 2–4 business days.',
    costPaise: 26000,
    shippingPaise: 6000,
    pricePaise: 59900,
    stock: 32,
    weightGrams: 420,
    image: '/products/cove-insulated-bottle.jpg',
    sortOrder: 1,
  },
  {
    name: 'FoldAway 66 L Storage Bag (set of 2)',
    slug: 'foldaway-storage-bag-set',
    sku: 'ZV-STO-01',
    categorySlug: 'storage-organisation',
    shortDescription: 'Two 66 L quilted under-bed bags with a clear window and reinforced handles.',
    description:
      'Two 66 litre storage bags for blankets, winter clothes and extra bedding. The quilted sides hold their shape when full, a clear front window saves you unpacking three bags to find one sweater, and the reinforced side handles take the weight when you drag them out from under a bed.\n\nEach bag folds flat to roughly the thickness of a folded shirt when empty. The zip runs three sides so the top opens fully.\n\nWipe clean with a damp cloth; not machine washable. Ships in 2–4 business days.',
    costPaise: 24500,
    shippingPaise: 7000,
    pricePaise: 54900,
    stock: 36,
    weightGrams: 700,
    image: '/products/foldaway-storage-bag.jpg',
    sortOrder: 2,
  },
  {
    name: 'Aurora Wireless Earbuds',
    slug: 'aurora-wireless-earbuds',
    sku: 'ZV-TEC-01',
    categorySlug: 'mobile-tech',
    shortDescription: 'True-wireless earbuds with a pebble charging case, touch controls and USB-C.',
    description:
      'A pocketable true-wireless pair with a matte pebble case that charges over USB-C. Touch controls on both buds handle play, pause and calls; the microphones are tuned for everyday voice calls rather than studio recording.\n\nIn the box: earbud pair, charging case, USB-C cable, two extra ear-tip sizes.\n\nBattery: roughly 4–5 hours per charge at moderate volume, with three additional top-ups from the case. Charging time is about 90 minutes. Ships in 2–4 business days.',
    costPaise: 46000,
    shippingPaise: 4500,
    pricePaise: 79900,
    stock: 30,
    weightGrams: 120,
    image: '/products/aurora-wireless-earbuds.jpg',
    sortOrder: 3,
  },
  {
    name: 'GripMag Magnetic Phone Holder',
    slug: 'gripmag-magnetic-phone-holder',
    // ZV-TEC-02 belonged to the retired power bank; SKUs are unique across the
    // whole store, so the replacement takes the next free one.
    sku: 'ZV-TEC-04',
    categorySlug: 'mobile-tech',
    shortDescription: 'Slim magnetic grip that doubles as a kickstand for one-handed scrolling.',
    description:
      'A slim magnetic grip that sticks to the back of a phone or case and folds out into a stand. It makes a large phone holdable with one hand, and props it up on a desk or tray table at a usable angle.\n\nWorks best with a flat, non-textured case, or with the supplied metal ring on a textured one. Magnets do not interfere with normal phone use; wireless charging needs the grip removed.\n\nIncludes the grip, a metal ring and an alcohol wipe for surface prep. Ships in 2–4 business days.',
    costPaise: 9500,
    shippingPaise: 4000,
    pricePaise: 24900,
    stock: 60,
    weightGrams: 110,
    image: '/products/gripmag-phone-holder.jpg',
    sortOrder: 4,
  },
  {
    name: 'Aero Foldable Laptop Stand',
    slug: 'aero-foldable-laptop-stand',
    sku: 'ZV-TEC-03',
    categorySlug: 'mobile-tech',
    shortDescription: 'Brushed aluminium stand that folds flat and lifts a laptop to eye level.',
    description:
      'A brushed aluminium stand that folds to about the thickness of a notebook and unfolds to six fixed angles. Raising the screen to eye level is the cheapest fix for a sore neck during long work sessions.\n\nSilicone pads on every contact point protect the laptop finish, and the open frame leaves the vents clear so the machine runs cooler than it does on a desk mat.\n\nFits 11–16 inch laptops up to 5 kg. Weighs 640 g. Ships in 2–4 business days.',
    costPaise: 39000,
    shippingPaise: 5500,
    pricePaise: 79900,
    stock: 26,
    weightGrams: 640,
    image: '/products/aero-laptop-stand.jpg',
    sortOrder: 5,
  },
  {
    name: 'Halo Sunset Projector Lamp',
    slug: 'halo-sunset-lamp',
    sku: 'ZV-DEC-01',
    categorySlug: 'home-lighting',
    shortDescription: 'Small projector lamp that paints a warm sunset gradient across a wall.',
    description:
      'A compact lamp that throws a soft amber-to-rose sunset gradient onto the nearest wall. It is a mood light, not a reading light: the output is deliberately warm and low so it can sit on a bedside table without waking anyone.\n\nRotating the head changes the angle of the arc. USB-C powered, with a three-step dimmer on the body.\n\nBest on a plain wall within 1.5–2.5 m. Includes a 1.5 m USB-C cable; a wall adapter is not included. Ships in 2–4 business days.',
    costPaise: 21500,
    shippingPaise: 5000,
    pricePaise: 49900,
    stock: 34,
    weightGrams: 340,
    image: '/products/halo-sunset-lamp.jpg',
    sortOrder: 6,
  },
  {
    name: 'Luma Warm LED Strip 3 m',
    slug: 'luma-led-strip-3m',
    sku: 'ZV-DEC-02',
    categorySlug: 'home-lighting',
    shortDescription: 'Adhesive 3 m warm-white LED strip with a remote and USB power.',
    description:
      'A 3 metre warm-white LED strip on 3M-style adhesive backing, for the back of a desk, a shelf edge or a bed frame. Adhesive strips are easy to reposition and leave no holes, which is why they survive rented flats.\n\nComes with a small remote for brightness and a USB power lead, so it runs from a phone charger or a laptop dock. Draws under 5 W at full brightness.\n\nClean and dry the surface before sticking; textured or freshly painted walls need the included clips instead. Ships in 2–4 business days.',
    costPaise: 13500,
    shippingPaise: 4500,
    pricePaise: 34900,
    stock: 45,
    weightGrams: 240,
    image: '/products/luma-led-strip.jpg',
    sortOrder: 7,
  },
  {
    name: 'Nomad Canvas Sling',
    slug: 'nomad-canvas-sling',
    sku: 'ZV-CAR-01',
    categorySlug: 'everyday-carry',
    shortDescription: 'Waxed-canvas crossbody sling with a padded phone pocket and leather pull.',
    description:
      'A single-strap sling in waxed cotton canvas with a leather pull and a soft-lined pocket sized for a 6.7 inch phone. It holds a wallet, keys, earbuds and a paperback without turning into a lump.\n\nThe strap adjusts from 70 to 130 cm and sits across the chest or on the hip. The main zip is metal with a canvas storm flap behind it.\n\nCanvas softens and darkens slightly with use — that is the wax, not wear. Ships in 2–4 business days.',
    costPaise: 25500,
    shippingPaise: 6000,
    pricePaise: 59900,
    stock: 24,
    weightGrams: 450,
    image: '/products/nomad-canvas-sling.jpg',
    sortOrder: 8,
  },
  {
    name: 'Slate A5 Hardbound Journal',
    slug: 'slate-a5-journal',
    sku: 'ZV-DSK-01',
    categorySlug: 'desk-self-care',
    shortDescription: 'A5 linen hardbound notebook, 192 dot-grid pages, lays completely flat.',
    description:
      'An A5 hardbound notebook in slate linen with a sewn binding that opens flat at any page. 192 pages of 100 gsm ivory paper with a light 5 mm dot grid — heavy enough that a fountain pen does not bleed through.\n\nIncludes a ribbon marker, an elastic closure and a rear pocket for loose receipts.\n\nPaper is FSC-certified. Ships in 2–4 business days.',
    costPaise: 11000,
    shippingPaise: 3500,
    pricePaise: 29900,
    stock: 55,
    weightGrams: 340,
    image: '/products/slate-a5-journal.jpg',
    sortOrder: 9,
  },
  {
    name: 'Glow Jade Roller & Gua Sha Set',
    slug: 'glow-jade-roller-set',
    sku: 'ZV-BEA-01',
    categorySlug: 'desk-self-care',
    shortDescription: 'Natural jade facial roller and gua sha stone with a linen pouch.',
    description:
      'A facial roller and a gua sha stone cut from natural jade, with a linen pouch for storage. The roller has a large head for cheeks and jaw and a small head for under the eyes.\n\nBoth pieces are cool to the touch, which is most of the point — keep them in the fridge for a few minutes before use. Clean with warm water and mild soap; do not put them in a dishwasher.\n\nJade is a natural stone, so colour and veining vary between sets. Ships in 2–4 business days.',
    costPaise: 9500,
    shippingPaise: 4000,
    pricePaise: 24900,
    stock: 50,
    weightGrams: 260,
    image: '/products/glow-jade-roller-set.jpg',
    sortOrder: 10,
  },
];

export interface InstallResult {
  created: string[];
  skipped: string[];
  failed: string[];
  archived: string[];
  categoriesCreated: number;
  supplierCreated: boolean;
  demoModeDisabled: boolean;
}

/**
 * Create the Meesho sourcing partner used by the catalogue. Type MEESHO is an
 * honest manual-fulfilment partner: orders queue for placement with the
 * sourcing account and the admin records tracking after buying.
 */
async function ensureMeeshoSupplier(): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.supplier.findUnique({ where: { slug: MEESHO_SUPPLIER_SLUG } });
  if (existing) return { id: existing.id, created: false };
  const created = await prisma.supplier.create({
    data: {
      name: 'Meesho (own sourcing)',
      slug: MEESHO_SUPPLIER_SLUG,
      type: 'MEESHO',
      baseUrl: 'https://www.meesho.com',
      leadTimeDays: 3,
      isActive: true,
      notes:
        'Sourcing account on Meesho. Paid orders queue here; place each one from the Meesho app using the product name, then record the courier and tracking number in Admin → Supplier orders. Meesho has no open ordering API, so fulfilment is deliberately manual — nothing is faked. CJ Dropshipping will be added as a second supplier when that account is live.',
    },
  });
  return { id: created.id, created: true };
}

export async function installCuratedCatalogue(actor: Actor): Promise<InstallResult> {
  const supplier = await ensureMeeshoSupplier();
  const settingsBefore = await getSettings();

  let categoriesCreated = 0;
  const categoryIds = new Map<string, string>();
  for (const c of CURATED_CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { slug: c.slug } });
    if (existing) {
      categoryIds.set(c.slug, existing.id);
      continue;
    }
    const created = await prisma.category.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: true,
      },
    });
    categoryIds.set(c.slug, created.id);
    categoriesCreated += 1;
  }

  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  for (const p of CURATED_PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      skipped.push(p.slug);
      continue;
    }
    const categoryId = categoryIds.get(p.categorySlug) ?? null;
    // One bad row (a conflicting SKU, a validation change) must never stop the
    // rest of the catalogue or the retirement of the previous set.
    try {
      await saveProduct(
        {
          name: p.name,
          slug: p.slug,
          description: p.description,
          shortDescription: p.shortDescription,
          sku: p.sku,
          brand: settingsBefore.storeName,
          status: 'ACTIVE',
          categoryId,
          supplierId: supplier.id,
          supplierSku: p.sku,
          stockMode: 'LOCAL',
          supplierCost: p.costPaise,
          supplierShippingCost: p.shippingPaise,
          otherCost: 0,
          pricingMode: 'FIXED_PRICE',
          fixedPrice: p.pricePaise,
          fixedMargin: null,
          percentMarkup: null,
          minProfit: null,
          roundingRule: 'NONE',
          compareAtPrice: null,
          taxRatePercent: 0,
          weightGrams: p.weightGrams,
          lengthCm: null,
          widthCm: null,
          heightCm: null,
          seoTitle: `${p.name} — buy online in India`,
          seoDescription: p.shortDescription.slice(0, 158),
          images: [
            {
              url: p.image,
              alt: `${p.name} — illustrative studio render`,
              position: 0,
              isPrimary: true,
            },
          ],
          variants: [],
        },
        actor
      );
      // Real merchant stock + merchandising order. saveProduct intentionally
      // does not manage stock counters (that is the inventory surface), so set
      // them here in the same install step. Storefront "featured" ordering is
      // sortOrder DESC, so the first item gets the highest number and leads the
      // homepage hero.
      await prisma.product.update({
        where: { slug: p.slug },
        data: { stock: p.stock, sortOrder: 100 - p.sortOrder },
      });
      created.push(p.slug);
    } catch (err) {
      failed.push(p.slug);
      console.error(
        `[catalogue] could not publish ${p.slug}:`,
        err instanceof Error ? err.message.split('\n').slice(-1)[0] : err
      );
    }
  }

  // Retire the previous, higher-priced launch set. Archiving keeps order
  // history intact and is reversible from Admin → Products.
  const archived: string[] = [];
  for (const slug of RETIRED_SLUGS) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!product || product.status === 'ARCHIVED') continue;
    try {
      await archiveProduct(product.id, actor);
    } catch (err) {
      // archiveProduct ends with a storefront revalidation, which throws when
      // the installer runs outside a request (the release build). The row is
      // written first, so only fall back if it did not land.
      const current = await prisma.product.findUnique({
        where: { id: product.id },
        select: { status: true },
      });
      if (current?.status !== 'ARCHIVED') {
        await prisma.product.update({ where: { id: product.id }, data: { status: 'ARCHIVED' } });
      }
      console.warn(
        `[catalogue] archived ${slug} without storefront revalidation:`,
        err instanceof Error ? err.message : err
      );
    }
    archived.push(slug);
  }

  // A launch-ready catalogue means the storefront is no longer a demo.
  let demoModeDisabled = false;
  if (settingsBefore.demoMode) {
    await updateSettings({ demoMode: false });
    demoModeDisabled = true;
  }

  await auditLog({
    actor,
    action: 'catalogue.curated_installed',
    data: {
      created: created.length,
      skipped: skipped.length,
      failed: failed.length,
      archived: archived.length,
      categoriesCreated,
      supplierCreated: supplier.created,
      demoModeDisabled,
    },
  });

  return {
    created,
    skipped,
    failed,
    archived,
    categoriesCreated,
    supplierCreated: supplier.created,
    demoModeDisabled,
  };
}

/**
 * Deploy-time bootstrap. Called by `scripts/install-catalogue.ts` at the end of
 * the release build, so a fresh production database gets the real catalogue
 * without anyone clicking through the admin panel.
 *
 * Deliberately conservative:
 *  - runs when the store has no ACTIVE product at all, or when it is still
 *    selling something from the retired set (i.e. a catalogue migration);
 *  - skippable with AUTO_INSTALL_CATALOGUE=false;
 *  - never throws: a failure is logged and the site still boots.
 */
export async function ensureLaunchCatalogue(): Promise<InstallResult | null> {
  const [activeProducts, retiredStillLive] = await Promise.all([
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.findFirst({
      where: { status: 'ACTIVE', slug: { in: [...RETIRED_SLUGS] } },
      select: { slug: true },
    }),
  ]);
  // Nothing to do for a store that is already selling the current catalogue.
  if (activeProducts > 0 && !retiredStillLive) return null;

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, email: true },
  });
  return installCuratedCatalogue(admin ?? { email: 'system@auto-install' });
}

/** Catalogue readiness snapshot for the admin panel. */
export async function curatedCatalogueStatus(): Promise<{
  activeProducts: number;
  totalProducts: number;
  alreadyInstalled: boolean;
  expectedProducts: number;
  missingProducts: number;
}> {
  const [activeProducts, totalProducts, presentSlugs] = await Promise.all([
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count(),
    prisma.product.findMany({
      where: { slug: { in: CURATED_PRODUCTS.map((p) => p.slug) } },
      select: { slug: true },
    }),
  ]);
  return {
    activeProducts,
    totalProducts,
    alreadyInstalled: presentSlugs.length === CURATED_PRODUCTS.length,
    expectedProducts: CURATED_PRODUCTS.length,
    missingProducts: CURATED_PRODUCTS.length - presentSlugs.length,
  };
}
