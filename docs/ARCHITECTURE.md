# Architecture Document
## WELL LUPS AUTO TYRES LIMITED — Platform

## 1. Summary

A custom application: Next.js frontend on Cloudflare Workers via `@opennextjs/cloudflare`, backed entirely by Supabase (Postgres, Auth, Storage, Edge Functions). Single branch, single stock pool. No CMS, no e-commerce plugin layer, no separate Node/API service.

**ADR-01 — Frontend hosting: Cloudflare Workers via `@opennextjs/cloudflare`, not Cloudflare Pages.** The platform requires server-side rendering (App Router, RSC, Server Actions) for the SEO and AI Engine Optimization requirements in `PRD.md`. Cloudflare Pages serves static exports only and cannot host a server-rendered App Router app — using it would strip the SSR that the AI EO/SEO requirement depends on. Consequences: requires `compatibility_flags = ["nodejs_compat"]` and a compatible `compatibility_date`; Next.js 16+/Turbopack isn't yet supported by OpenNext, so the project pins to a webpack-compatible Next.js 15 build; the Worker size limit (3MB compressed on the free tier) requires bundle-size awareness at build time; `wrangler.toml` replaces `next.config.js` for Workers-specific settings.

**On the existing static prototype (`prototype/welllups.html`):** it is a frontend visual/interaction reference only. It hardcodes two branches, placeholder statistics, and fixed prices — none of that is real and none of it should be ported as-is. Real implementation always queries Supabase; the prototype only informs layout, motion, and visual tone.

## 2. Components

```
┌─────────────────────────────────┐
│      Next.js Frontend             │  Public storefront + service booking
│      (Cloudflare Workers)         │  + role-gated staff/admin dashboard
└────────────────┬───────────────────┘
                 │
┌────────────────▼───────────────────┐
│              Supabase                 │
│  ┌────────────┬────────────────────┐ │
│  │  Postgres   │  Auth               │ │
│  ├────────────┼────────────────────┤ │
│  │  Storage    │  Edge Functions     │ │
│  └────────────┴────────────────────┘ │
└──────────────────────────────────────┘
```

The public storefront and staff/admin dashboard are sections of one Next.js application, gated by role via Supabase Auth. Custom server-side logic (payment webhooks, notification triggers, stock/margin calculations, quote handling) runs in Supabase Edge Functions.

## 3. Data Model

- **Product** — name, SKU, category, brand, size/specification, cost price, sell price, stock quantity, image, status. No public-facing price field is rendered; sell price exists for internal margin calculation and for populating an accepted quote.
- **Service** — name, description, applicable vehicle types, availability flag. No fixed price field — priced per quote/inspection.
- **Category** — shared taxonomy across products and services.
- **Vehicle** — make, model, year, trim.
- **QuoteRequest** — customer (or contact details if not logged in), item reference (product or service), status (New → Responded → Accepted/Declined/Expired), agreed price once set, timestamps.
- **Order** — created once a quote is accepted (or directly for in-shop sales); line items, payment method, fulfillment type (pickup/delivery), status.
- **ServiceBooking** — service, vehicle, preferred date, status; payment always recorded in-shop.
- **Review** — linked to a product or service, customer, rating, text.
- **Wishlist** — customer, saved items.
- **StaffUser** — name, role (Admin / Manager / Cashier), Supabase Auth identity.
- **Branch** — kept as an entity for architectural flexibility, but only one row exists at launch; all stock, orders, and bookings reference this single branch, and no per-branch pooling logic is built.

## 4. Integrations

| Integration | Purpose | Implementation |
|---|---|---|
| M-Pesa (Paybill and Till, hybrid) | Payment for goods | Edge Function handles the payment webhook; reads a single `active_payment_channel` config value so only one of Paybill/Till is live at a time |
| WhatsApp click-to-chat | Quote inquiries, general contact | Static `wa.me` link, no backend dependency — launch-ready immediately |
| WhatsApp Cloud API (Meta) | Automated order/booking notifications | Fast-follow after Meta business verification and message template approval; triggered from Edge Functions on status changes |
| Supabase Storage | Product/service images | — |
| Structured data (schema.org) | SEO and AI EO | Rendered server-side in Next.js |
| Google Search Console | Indexing | Submitted after launch |

## 5. Security & Access Control

- Three roles — Admin, Manager, Cashier — enforced via Supabase Auth plus Row-Level Security.
- Cost price and margin are visible to Admin only; Manager sees sales/revenue totals without cost/margin; Cashier sees neither.
- HTTPS throughout.

## 6. Hosting

- **Frontend:** Cloudflare Workers, via `@opennextjs/cloudflare` (see ADR-01, §1)
- **Backend, database, auth, storage:** Supabase
- **Domain:** to be registered

## 7. Code Architecture Principles

See `CODE_STANDARDS.md` for the full standard. In summary: no God components — data fetching, business logic, and presentation are kept in separate layers (server components / hooks / services vs. presentational UI), and schema and API design favor small, well-named, single-responsibility pieces over convenience shortcuts.

## 8. Risks

- **Prototype-vs-reality drift.** The static prototype's hardcoded two-branch content, invented statistics, and fixed prices must not leak into the real build. Explicit call-out in `ROADMAP.md` and `CLAUDE.md`.
- **Quote-flow complexity.** A quote-based commerce model is inherently more involved than fixed-price checkout — sequencing (Roadmap v0.3) keeps this isolated and well-tested before layering payment on top.
- **WhatsApp Cloud API lead time.** Meta's verification process should start immediately, independent of the build schedule.
- **Data dependency.** Catalog and service structure can't be finalized until the product/price list and services list are delivered.
