# Meesho sourcing

Nirvora resells Meesho listings. This document records what Meesho actually
exposes, why the store does not scrape, and how the sourcing screen works.

## What Meesho exposes (checked November 2026)

| Thing | Available? |
| --- | --- |
| Public product / catalogue API | **No** |
| Self-serve developer keys | **No** |
| Supplier / Order-Management API | **Partner-gated** — `merchant.meesho.com`, credentials issued during onboarding as an enrolled supplier or integration partner |
| Public docs / OpenAPI | **No** for the supplier API; only partner material |
| Supported practical integrations | Supplier Panel, bulk upload sheets, reports, the Supplier app, selected OMS partners |

GitHub projects that claim a "Meesho API" are unofficial scrapers, browser
automations or reseller kits. They break on any panel change, violate Meesho's
terms, and would leave the store's prices and stock silently wrong. Nirvora
therefore does **not** scrape Meesho and does **not** invent a sync.

If the owner is ever onboarded to Meesho's partner Supplier API, the existing
`HTTP_REST` supplier adapter (`docs/SUPPLIER_API.md`) is the drop-in path: no
store code changes, only endpoint and credential configuration.

## How sourcing works instead

`Admin → Catalog → Meesho sourcing` (`/admin/sourcing`).

1. The owner copies the rows Meesho already shows: name, price, MRP, rating,
   reviews, units sold and return rate.
2. `src/lib/sourcing/meesho.ts` parses the pasted sheet. A row without a usable
   price, or with a non-Meesho link, is reported by line number — never guessed.
3. `src/lib/sourcing/score.ts` scores each listing out of 100:

   | Signal | Weight | Notes |
   | --- | --- | --- |
   | Margin | 40 | landed cost → target price at 45% margin, rounded to a ₹…9 price |
   | Return rate | 20 | ≤5% full marks; ≥25% zero |
   | Demand | 20 | units sold, else review count, log scale |
   | Rating | 10 | 4.5★+ full marks |
   | Trend | 10 | optional 0–100 signal |

   Verdicts: `PUBLISH` (score ≥65 **and** return rate known **and** margin above
   the store floor), `WATCH`, `SKIP`. Unknown return rate can never be
   `PUBLISH` — missing evidence is not good news.
4. Saved candidates upsert by stable key (Meesho slug → SKU → name+price), so
   re-scoring updates evidence instead of duplicating rows.
5. **Create draft** carries the real landed cost and suggested price into a
   `DRAFT` product. Photos, description and publishing stay owner actions, in
   line with the rest of the admin.

## The order hand-off

Meesho has no ordering API, so the owner places the purchase in the Meesho app.

1. A paid order is queued in `Admin → Suppliers → Supplier orders`.
2. The owner places it on Meesho and opens **Record Meesho ID**, entering the
   reference as `MEESHO-XXXXXXXX`.
3. `recordMeeshoOrderPlacement` stores the reference, marks the supplier order
   accepted, advances the customer order, records an order event and emails the
   customer that the order is confirmed.
4. From there the team owns the rest: dispatch, tracking, delivery and the
   customer messages that go with them. The owner is only asked again if a
   fulfilment genuinely fails.

The 24×7 co-founder voice (`/admin/cofounder`) reads the same queue and speaks
the order number, city, customer value and expected margin — so the Meesho
purchase can be placed without opening the admin on a phone.
