# Architecture Document
## WELL LUPS AUTO TYRES LIMITED — Platform

## 1. Summary

The platform is a custom application: a Next.js frontend deployed on Cloudflare Pages, backed by Supabase for database, authentication, storage, and server-side logic. There is no CMS or e-commerce plugin layer — all product, service, booking, and POS logic is purpose-built.

## 2. Components

```
┌─────────────────────────────────┐
│      Next.js Frontend             │  Public storefront + service booking
│      (Cloudflare Pages)           │  + role-gated staff/admin dashboard
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

The public storefront and the staff/admin dashboard are sections of the same Next.js application, gated by role via Supabase Auth — not separate products.

Custom server-side logic (payment webhooks, notification triggers, stock/margin calculations) runs in Supabase Edge Functions rather than a separate backend service, keeping the system on a single coherent platform.

## 3. Data Model

- **Product** — name, SKU, category, brand, size/specification, cost price, sell price, stock quantity, image, status
- **Service** — name, description, price or "quote on inspection," applicable vehicle types, availability flag
- **Category** — shared taxonomy across products and services
- **Vehicle** — make, model, year, trim (used by both the vehicle filter and "My Vehicle" profiles)
- **Order** — line items, payment method, fulfillment type (pickup/delivery), status
- **ServiceBooking** — service, vehicle, preferred branch, preferred date, status; payment always recorded in-shop
- **Review** — linked to a product or service, customer, rating, text
- **Wishlist** — customer, saved items
- **StaffUser** — name, role (Admin / Owner / Cashier), assigned branch, Supabase Auth identity
- **Branch** — name, address, contact details, stock reference

**Needs input from client:** whether stock is a single shared pool or tracked per branch — this determines the Product–Branch relationship directly and should be resolved before schema work begins.

## 4. Integrations

| Integration | Purpose | Implementation |
|---|---|---|
| M-Pesa (STK Push, Paybill or Till) | Online payment for goods | Handled via a Supabase Edge Function processing the payment webhook |
| WhatsApp Business API | Automated order and booking status notifications | Triggered from Supabase Edge Functions on order/booking status changes |
| Supabase Storage | Product and service images | — |
| Structured data (schema.org) | SEO and AI Engine Optimization | Rendered server-side in the Next.js app |
| Google Search Console | Indexability and search visibility | Sitemap and metadata submitted post-launch |

**Needs input from client:** M-Pesa Paybill vs. Till number; whether WhatsApp Business API access is already set up or needs to be provisioned (Meta business verification and message template approval are required before automated messaging can go live).

## 5. Security & Access Control

- Three roles — Admin, Owner, Cashier — enforced through Supabase Auth combined with row-level security (RLS) policies on relevant tables.
- Cost price and margin data are restricted from the Cashier role by default via RLS policy.
- HTTPS enforced throughout, on both the frontend and Supabase endpoints.

## 6. Hosting

- **Frontend:** Cloudflare Pages
- **Backend, database, auth, storage:** Supabase
- **Domain:** to be registered (name not yet chosen)
- **SSL:** provided natively by both Cloudflare and Supabase
- **Backups:** Supabase's managed Postgres backups

## 7. Risks

- **Scope breadth.** The confirmed feature set spans a full commerce catalog, a distinct service-booking system, a POS with margin tracking, and automated notifications — all as original, purpose-built work. Sequencing (see `ROADMAP.md`) is what keeps this achievable at consistent quality rather than spreading effort thin across everything at once.
- **WhatsApp Business API setup time.** Meta's business verification and message-template approval process can take longer than expected and should be started early, independent of the rest of the build.
- **Data dependency.** Catalog and service-page structure cannot be finalized until the product/price list and services list are delivered.
