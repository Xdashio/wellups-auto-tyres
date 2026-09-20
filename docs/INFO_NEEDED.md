# Information Needed From Client
## WELL LUPS AUTO TYRES LIMITED — Platform

## Blocking — required before backend/schema work begins

1. **Stock pooling model.** Is stock a single pool shared across both branches, or tracked separately per branch? This determines the Product–Branch relationship in the schema.
2. **Product and price list.** Full catalog with categories, pricing, and stock levels.
3. **Services list.** Full list of services offered with pricing logic (fixed vs. varies by vehicle type).
4. **Admin / Manager / Cashier permission boundaries.** Specifically, what Manager can see/do that Cashier cannot, and whether Manager's access differs from Admin's.

## Needed before related features can be finalized

5. **M-Pesa Paybill vs. Till number.**
6. **Delivery scope.** Which areas are served, and any delivery fee structure.
7. **Domain name.**
8. **WhatsApp Business API status.** Whether Meta business verification has been started, or needs to be initiated (this has its own lead time, independent of development).
9. **Warranty/returns policy wording**, if a formal policy already exists.
10. **Ad and search-indexing plans.** Any intent to run paid ads (Google/Meta), to be scoped as a separate workstream from the core build.

## Design-related

11. ~~Master logo file for exact color extraction~~ — resolved, palette received (see `DESIGN.md` §3).
12. **Vector logo source** (SVG/AI/EPS), if one exists — the palette and a raster (.webp) have been provided; a true vector file would still help for crisp scaling (favicon, large-format use) but is not blocking.
13. Any additional brand assets (photography, secondary marks), if they exist.
