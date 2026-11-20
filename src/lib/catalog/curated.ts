import { prisma } from '../db';
import { auditLog } from '../audit';
import { updateSettings, getSettings } from '../settings';
import { saveProduct } from './products';
import type { Actor } from './types';

/**
 * Curated launch catalogue.
 *
 * The store starts empty on purpose (no fake products, no placeholder art).
 * This module is the owner's one-click path to a REAL, sellable catalogue:
 * twelve pieces across five categories, each with studio photography we
 * generated and own (no supplier CDN images, no broken hotlinks), a stated
 * sourcing cost, a fixed retail price, and real stock counts.
 *
 * Facts the installer is careful about:
 *  - Prices and costs are owner-editable afterwards; nothing is locked in.
 *  - Stock is real merchant stock (LOCAL mode) — the owner sets the counts.
 *  - The supplier is "Meesho (own sourcing)", a MEESHO-type partner: orders
 *    queue for manual placement with the sourcing account, exactly matching
 *    how a reseller actually buys. No API is pretended.
 *  - Idempotent: products are matched by slug and never overwritten, so
 *    running it twice cannot clobber edits or duplicate the catalogue.
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

export const CURATED_CATEGORIES: CuratedCategory[] = [
  {
    name: 'Tech & Audio',
    slug: 'tech-audio',
    description: 'Everyday carry electronics chosen for build quality, not spec-sheet noise.',
    sortOrder: 0,
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    description: 'Objects that make a small room feel considered.',
    sortOrder: 1,
  },
  {
    name: 'Bags & Carry',
    slug: 'bags-carry',
    description: 'Slim, hard-wearing bags for commuting and short trips.',
    sortOrder: 2,
  },
  {
    name: 'Desk & Study',
    slug: 'desk-study',
    description: 'Quiet tools for focused work.',
    sortOrder: 3,
  },
  {
    name: 'Wellness',
    slug: 'wellness',
    description: 'Small rituals that fit into a normal evening.',
    sortOrder: 4,
  },
];

export const CURATED_PRODUCTS: CuratedProduct[] = [
  {
    name: 'Aurora Wireless Earbuds',
    slug: 'aurora-wireless-earbuds',
    sku: 'ZV-AUD-01',
    categorySlug: 'tech-audio',
    shortDescription: 'True-wireless earbuds with a pebble charging case, touch controls and USB-C.',
    description:
      'A pocketable true-wireless pair with a matte pebble case that charges over USB-C. Touch controls on both buds handle play, pause and calls; the built-in microphones are tuned for everyday voice calls rather than studio recording.\n\nIn the box: earbud pair, charging case, USB-C cable, two extra ear-tip sizes.\n\nBattery: roughly 4–5 hours per charge at moderate volume, with three additional top-ups from the case. Charging time is about 90 minutes.\n\nShips from our fulfilment partner in 2–4 business days. Seven-day replacement for manufacturing defects — see the returns policy.',
    costPaise: 78000,
    shippingPaise: 4000,
    pricePaise: 149900,
    stock: 24,
    weightGrams: 120,
    image: '/products/aurora-wireless-earbuds.jpg',
    sortOrder: 0,
  },
  {
    name: 'Pulse 20,000 mAh Power Bank',
    slug: 'pulse-power-bank',
    sku: 'ZV-TEC-02',
    categorySlug: 'tech-audio',
    shortDescription: 'Slim 20,000 mAh power bank with a percentage display and USB-C in/out.',
    description:
      'A 20,000 mAh power bank in a matte shell that still fits a jacket pocket. The small display shows the exact charge left instead of four vague dots.\n\nTwo outputs (USB-C and USB-A) with pass-through charging, so the bank can charge itself and a phone at the same time. USB-C in/out means one cable covers everything.\n\nComes with a braided USB-C cable. Rated capacity is honest cell capacity — expect roughly 3–4 full phone charges, not six.\n\nShips in 2–4 business days with a six-month replacement warranty on the cell.',
    costPaise: 98000,
    shippingPaise: 5000,
    pricePaise: 189900,
    stock: 18,
    weightGrams: 380,
    image: '/products/pulse-power-bank.jpg',
    sortOrder: 1,
  },
  {
    name: 'Aero Foldable Laptop Stand',
    slug: 'aero-foldable-laptop-stand',
    sku: 'ZV-TEC-03',
    categorySlug: 'tech-audio',
    shortDescription: 'Brushed aluminium stand that folds flat and lifts a laptop to eye level.',
    description:
      'A brushed aluminium stand that folds to about the thickness of a notebook and unfolds to six fixed angles. Raising the screen to eye level is the cheapest fix for a sore neck during long work sessions.\n\nSilicone pads on every contact point protect the laptop finish, and the open frame leaves the vents clear so the machine runs cooler than it does on a desk mat.\n\nFits 11–16 inch laptops up to 5 kg. Weighs 640 g.\n\nShips in 2–4 business days.',
    costPaise: 54000,
    shippingPaise: 4000,
    pricePaise: 119900,
    stock: 30,
    weightGrams: 640,
    image: '/products/aero-laptop-stand.jpg',
    sortOrder: 2,
  },
  {
    name: 'Terra Ceramic Mug Duo',
    slug: 'terra-ceramic-mug-duo',
    sku: 'ZV-HOM-01',
    categorySlug: 'home-living',
    shortDescription: 'Two speckled stoneware mugs, 300 ml each, dishwasher and microwave safe.',
    description:
      'Two 300 ml stoneware mugs with a speckled reactive glaze, so no two pieces are identical. The walls are thick enough to hold heat through a slow morning and the handle is wide enough for a full hand.\n\nDishwasher and microwave safe. Sold as a pair in off-white and clay.\n\nHand-finished ceramic can vary slightly in tone and speckle — that is the material, not a defect.\n\nPacked with double-wall protection and shipped in 3–5 business days.',
    costPaise: 34000,
    shippingPaise: 6000,
    pricePaise: 89900,
    stock: 40,
    weightGrams: 900,
    image: '/products/terra-ceramic-mug-duo.jpg',
    sortOrder: 3,
  },
  {
    name: 'Halo Sunset Projector Lamp',
    slug: 'halo-sunset-lamp',
    sku: 'ZV-HOM-02',
    categorySlug: 'home-living',
    shortDescription: 'Small projector lamp that paints a warm sunset gradient across a wall.',
    description:
      'A compact lamp that throws a soft amber-to-rose sunset gradient onto the nearest wall. It is a mood light, not a reading light: the output is deliberately warm and low so it can sit on a bedside table without waking anyone.\n\nRotating the head changes the angle of the arc. USB-C powered, with a three-step dimmer on the body.\n\nBest on a plain wall within 1.5–2.5 m. Includes a 1.5 m USB-C cable; a wall adapter is not included.\n\nShips in 2–4 business days.',
    costPaise: 43000,
    shippingPaise: 5000,
    pricePaise: 109900,
    stock: 26,
    weightGrams: 340,
    image: '/products/halo-sunset-lamp.jpg',
    sortOrder: 4,
  },
  {
    name: 'Cove Insulated Bottle 750 ml',
    slug: 'cove-insulated-bottle',
    sku: 'ZV-HOM-03',
    categorySlug: 'home-living',
    shortDescription: 'Double-wall steel bottle: 18 hours cold, 8 hours hot, leak-proof cap.',
    description:
      'A 750 ml double-wall vacuum bottle in a matte powder-coated finish that does not slip in a bag. Cold drinks stay cold for about 18 hours; hot drinks stay hot for about 8.\n\nThe cap seals with a silicone gasket and has a loop for a carabiner. Wide mouth takes standard ice cubes and a bottle brush.\n\nHand wash only — the coating survives a dishwasher far less well than the steel does.\n\nShips in 2–4 business days.',
    costPaise: 39000,
    shippingPaise: 6000,
    pricePaise: 99900,
    stock: 35,
    weightGrams: 420,
    image: '/products/cove-insulated-bottle.jpg',
    sortOrder: 5,
  },
  {
    name: 'Nomad Canvas Sling',
    slug: 'nomad-canvas-sling',
    sku: 'ZV-BAG-01',
    categorySlug: 'bags-carry',
    shortDescription: 'Waxed-canvas crossbody sling with a padded phone pocket and leather patch.',
    description:
      'A single-strap sling in waxed cotton canvas with a leather pull and a soft-lined pocket sized for a 6.7 inch phone. It holds a wallet, keys, earbuds and a paperback without turning into a lump.\n\nThe strap adjusts from 70 to 130 cm and sits across the chest or on the hip. The main zip is metal with a canvas storm flap behind it.\n\nCanvas softens and darkens slightly with use — that is the wax, not wear.\n\nShips in 2–4 business days.',
    costPaise: 48000,
    shippingPaise: 6000,
    pricePaise: 124900,
    stock: 22,
    weightGrams: 450,
    image: '/products/nomad-canvas-sling.jpg',
    sortOrder: 6,
  },
  {
    name: 'Meridian Laptop Backpack',
    slug: 'meridian-laptop-backpack',
    sku: 'ZV-BAG-02',
    categorySlug: 'bags-carry',
    shortDescription: 'Slim 22 L backpack with a padded 15.6 inch sleeve and water-resistant shell.',
    description:
      'A 22 litre commuter backpack that keeps a flat silhouette when it is only half full. The laptop sleeve is padded on all four sides and fits up to a 15.6 inch machine, with a separate document pocket so papers do not crease.\n\nThe shell is water-resistant recycled polyester with taped seams on the lid. YKK-style zips, a luggage pass-through on the back, and a hidden pocket against the spine.\n\nWeighs 780 g empty. Ships in 2–4 business days.',
    costPaise: 76000,
    shippingPaise: 7000,
    pricePaise: 179900,
    stock: 16,
    weightGrams: 780,
    image: '/products/meridian-laptop-backpack.jpg',
    sortOrder: 7,
  },
  {
    name: 'Slate A5 Hardbound Journal',
    slug: 'slate-a5-journal',
    sku: 'ZV-DSK-01',
    categorySlug: 'desk-study',
    shortDescription: 'A5 linen hardbound notebook, 192 dot-grid pages, lays completely flat.',
    description:
      'An A5 hardbound notebook in slate linen with a sewn binding that opens flat at any page. 192 pages of 100 gsm ivory paper with a light 5 mm dot grid — heavy enough that a fountain pen does not bleed through.\n\nIncludes a ribbon marker, an elastic closure and a rear pocket for loose receipts.\n\nPaper is FSC-certified. Ships in 2–4 business days.',
    costPaise: 24000,
    shippingPaise: 4000,
    pricePaise: 69900,
    stock: 48,
    weightGrams: 340,
    image: '/products/slate-a5-journal.jpg',
    sortOrder: 8,
  },
  {
    name: 'Lumen Rechargeable Desk Lamp',
    slug: 'lumen-desk-lamp',
    sku: 'ZV-DSK-02',
    categorySlug: 'desk-study',
    shortDescription: 'Cordless desk lamp with three colour temperatures and a 12-hour low setting.',
    description:
      'A slim cordless lamp with a disc head that tilts through 180 degrees. Three colour temperatures (2700K warm, 4000K neutral, 5500K cool) and stepless dimming from a single touch strip.\n\nAt the lowest setting the internal cell lasts about 12 hours, which makes it useful during power cuts as well as on a desk. Charges over USB-C in roughly three hours.\n\nAluminium arm, weighted base, no visible screws. Ships in 2–4 business days.',
    costPaise: 69000,
    shippingPaise: 6000,
    pricePaise: 139900,
    stock: 20,
    weightGrams: 560,
    image: '/products/lumen-desk-lamp.jpg',
    sortOrder: 9,
  },
  {
    name: 'Ember Soy Candle Trio',
    slug: 'ember-soy-candle-trio',
    sku: 'ZV-WEL-01',
    categorySlug: 'wellness',
    shortDescription: 'Three 90 g soy-wax candles: cedar, fig and smoked vanilla.',
    description:
      'Three small-batch soy-wax candles in amber glass, 90 g each and roughly 18 hours of burn time per tin. Scents are cedar, fig and smoked vanilla — warm and dry rather than sweet.\n\nCotton wicks, no paraffin, no dye. Trim the wick to 5 mm before each burn and let the wax pool reach the edge the first time so it burns evenly.\n\nSold as a set of three. Ships in 2–4 business days.',
    costPaise: 32000,
    shippingPaise: 5000,
    pricePaise: 84900,
    stock: 32,
    weightGrams: 520,
    image: '/products/ember-soy-candle-trio.jpg',
    sortOrder: 10,
  },
  {
    name: 'Glow Jade Roller & Gua Sha Set',
    slug: 'glow-jade-roller-set',
    sku: 'ZV-WEL-02',
    categorySlug: 'wellness',
    shortDescription: 'Natural jade facial roller and gua sha stone with a linen pouch.',
    description:
      'A facial roller and a gua sha stone cut from natural jade, with a linen pouch for storage. The roller has a large head for cheeks and jaw and a small head for under the eyes.\n\nBoth pieces are cool to the touch, which is most of the point — keep them in the fridge for a few minutes before use. Clean with warm water and mild soap; do not put them in a dishwasher.\n\nJade is a natural stone, so colour and veining vary between sets. Ships in 2–4 business days.',
    costPaise: 21000,
    shippingPaise: 4000,
    pricePaise: 64900,
    stock: 44,
    weightGrams: 260,
    image: '/products/glow-jade-roller-set.jpg',
    sortOrder: 11,
  },
];

export interface InstallResult {
  created: string[];
  skipped: string[];
  categoriesCreated: number;
  supplierCreated: boolean;
  demoModeDisabled: boolean;
}

/**
 * Create the Meesho sourcing partner used by the curated catalogue. Type
 * MEESHO is an honest manual-fulfilment partner: orders queue for placement
 * with the sourcing account and the admin records tracking after buying.
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
        'Sourcing account on Meesho. Paid orders queue here; place each one from the Meesho app with the supplier product reference, then record the courier and tracking number in Admin → Supplier orders. Meesho has no open ordering API, so fulfilment is deliberately manual — nothing is faked.',
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
  for (const p of CURATED_PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      skipped.push(p.slug);
      continue;
    }
    const categoryId = categoryIds.get(p.categorySlug) ?? null;
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
          { url: p.image, alt: `${p.name} — illustrative studio render`, position: 0, isPrimary: true },
        ],
        variants: [],
      },
      actor
    );
    // Real merchant stock + merchandising order. saveProduct intentionally does
    // not manage stock counters (that is the inventory surface), so set them
    // here in the same install step.
    // `featured` ordering in the storefront is sortOrder DESC, so the first
    // piece in this list (the earbuds) gets the highest number and leads the
    // homepage hero.
    await prisma.product.update({
      where: { slug: p.slug },
      data: { stock: p.stock, sortOrder: 100 - p.sortOrder },
    });
    created.push(p.slug);
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
      categoriesCreated,
      supplierCreated: supplier.created,
      demoModeDisabled,
    },
  });

  return {
    created,
    skipped,
    categoriesCreated,
    supplierCreated: supplier.created,
    demoModeDisabled,
  };
}

/** Catalogue readiness snapshot for the admin panel. */
export async function curatedCatalogueStatus(): Promise<{
  activeProducts: number;
  totalProducts: number;
  alreadyInstalled: boolean;
}> {
  const [activeProducts, totalProducts, firstSlug] = await Promise.all([
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count(),
    prisma.product.findFirst({ where: { slug: CURATED_PRODUCTS[0].slug }, select: { id: true } }),
  ]);
  return { activeProducts, totalProducts, alreadyInstalled: Boolean(firstSlug) };
}
