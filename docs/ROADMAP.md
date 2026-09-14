# Build Roadmap
## WELL LUPS AUTO TYRES LIMITED — Platform

This defines the build sequence once all blocking information in `INFO_NEEDED.md` is resolved. The order reflects standard senior-engineering practice: the data layer and core logic are established before UI is wired to it, while the design system is developed in parallel once branding is locked — so frontend work never waits on both, but never runs ahead of a real schema either.

## Phase 0 — Finalize Inputs (blocking)

- Resolve stock-pooling model (shared vs. per-branch)
- Receive full product/price list and services list
- Confirm Admin / Owner / Cashier permission boundaries
- Confirm M-Pesa Paybill vs. Till
- Register domain

No schema or UI work should start before this phase closes — every downstream phase depends on at least one of these answers.

## Phase 1 — Backend Foundation

- Define the Postgres schema (products, services, categories, vehicles, orders, bookings, reviews, wishlists, staff users, branches)
- Set up Supabase Auth and role structure (Admin / Owner / Cashier)
- Implement Row-Level Security policies per role and, if applicable, per branch
- Seed the database with real product/service data once received

## Phase 2 — Core Backend Logic

- Edge Functions for: stock deduction on sale, per-item margin calculation, order/booking status transitions
- Edge Function for M-Pesa payment webhook handling
- Edge Function for WhatsApp Business API triggers (can be stubbed initially if Meta verification is still in progress)

## Phase 3 — Design System (parallel with Phases 1–2, starting once brand colors are extracted)

- Finalize color palette, typography, spacing scale
- Build the core component library (buttons, cards, form fields, badges, modals) in isolation before wiring to real data
- Define page templates for the key page types (catalog, detail, checkout, booking, dashboard)

## Phase 4 — Frontend Build

Sequenced by business criticality, not by ease of implementation:

1. Storefront core: catalog browsing, product detail, cart, checkout (M-Pesa + pay-in-shop)
2. Service booking flow
3. Staff POS and admin dashboard (stock, margin, reporting, booking queue)
4. Secondary customer features: vehicle filter, "My Vehicle" profile, wishlist, comparison tool, reviews
5. Content pages: warranty/returns, about, branch/contact

Each item should reach the same "clean, modern, creative, professional" bar before moving to the next — this build order protects quality on the highest-priority flows first.

## Phase 5 — Integrations

- Connect and test M-Pesa payment flow end-to-end
- Connect WhatsApp Business API notifications end-to-end (dependent on Meta verification completing)

## Phase 6 — SEO & AI Engine Optimization

- Structured data (schema.org) across product, service, and business pages
- Sitemap generation and Google Search Console submission
- Plain-language, answerable content review for AI EO
- Performance pass (Core Web Vitals) — directly affects both SEO ranking and AI EO crawlability

## Phase 7 — Quality Assurance

- Cross-device and cross-browser testing
- Accessibility audit against the component library
- End-to-end testing of checkout and booking flows
- Load/performance testing appropriate to expected traffic

## Phase 8 — Launch

- Domain cutover, production deployment
- Post-launch monitoring for errors and performance
- Final review of live search/AI EO indexing

---

**Working note for AI-assisted development:** at each phase, use the Claude Code skill appropriate to the task at hand (schema/migration work, component scaffolding, testing, documentation, etc.) rather than working unassisted where a skill already covers the task. See `CLAUDE.md` for the current list of installed skills and when to invoke each.
