/**
 * Generates the default social card at public/og-image.png (1200×630).
 *
 * The card is a committed static PNG rather than a runtime image route: no
 * cold-start cost on first share, no edge-runtime dependency, and the exact
 * bytes Google/Twitter/WhatsApp fetch are the ones in the repo.
 *
 * Re-run after changing the brand tagline:
 *   node scripts/generate-og-image.mjs
 *
 * Requires the Inter typeface to be visible to fontconfig (the repo does not
 * vendor fonts). On a typical Linux box: copy Inter.ttf into ~/.fonts and run
 * `fc-cache -f`. On macOS/Windows system fonts are used automatically.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'public', 'og-image.png');

const W = 1200;
const H = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="violet" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8B5CF6" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gold" x1="1" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#D9C08A" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#D9C08A" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#C6AD7A"/>
      <stop offset="0.6" stop-color="#8B5CF6"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0.2"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#0E0D14"/>
      <stop offset="1" stop-color="#08080A"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <circle cx="1030" cy="70" r="300" fill="url(#violet)"/>
  <circle cx="150" cy="590" r="280" fill="url(#gold)"/>

  <!-- hairline frame -->
  <rect x="36" y="36" width="${W - 72}" height="${H - 72}" fill="none" stroke="#FFFFFF" stroke-opacity="0.12"/>

  <!-- brand mark -->
  <circle cx="92" cy="104" r="9" fill="#C6AD7A"/>
  <text x="116" y="112" font-family="Inter, Helvetica, Arial, sans-serif" font-size="21" font-weight="600" letter-spacing="7" fill="#F5F3EC">AUREVYN</text>
  <text x="116" y="140" font-family="Inter, Helvetica, Arial, sans-serif" font-size="13" letter-spacing="4.5" fill="#9A9AA2">INDIA · EVERYDAY ESSENTIALS</text>

  <!-- headline -->
  <text x="88" y="300" font-family="Inter, Helvetica, Arial, sans-serif" font-size="76" font-weight="600" letter-spacing="-2.5" fill="#F5F3EC">Considered objects,</text>
  <text x="88" y="388" font-family="Inter, Helvetica, Arial, sans-serif" font-size="76" font-weight="600" letter-spacing="-2.5" fill="#D9C08A">honestly priced.</text>

  <rect x="88" y="432" width="300" height="3" fill="url(#rule)"/>

  <!-- proof line: every claim is enforced by the software -->
  <text x="88" y="486" font-family="Inter, Helvetica, Arial, sans-serif" font-size="23" font-weight="400" fill="#B9B9C2">Transparent ₹ pricing · Pan-India delivery</text>
  <text x="88" y="524" font-family="Inter, Helvetica, Arial, sans-serif" font-size="23" font-weight="400" fill="#B9B9C2">UPI &amp; Cash on Delivery · Tracked fulfilment</text>

  <!-- corner ticks -->
  <path d="M1128 96h-28M1128 96v28" stroke="#8B5CF6" stroke-opacity="0.9" fill="none"/>
  <path d="M72 566h28M72 566v-28" stroke="#C6AD7A" stroke-opacity="0.9" fill="none"/>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);

const { size } = await sharp(out).metadata().then(async (m) => ({ size: m.size ?? 0 }));
console.log(`wrote ${path.relative(root, out)} (${W}x${H}, ${size} bytes)`);
