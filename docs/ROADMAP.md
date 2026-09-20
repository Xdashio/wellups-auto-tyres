# Roadmap
## WELL LUPS AUTO TYRES LIMITED — Platform

This is the complete version ladder from the current state to a production-ready v1.0, plus what comes after. Each version is a real, working increment — not a mockup pass. `PROMPT_PACK.md` has the exact Claude Code prompt for each version.

## Current State (before v0.1)

What exists today:
- Full planning docs (this set).
- Brand assets: logo (background removed), extracted color palette.
- A static HTML prototype (`prototype/welllups.html`) — **visual/motion reference only**. It hardcodes two branches, placeholder statistics ("15+ years," "4.8 rating"), and a placeholder second phone number. None of this is real data, and none of it carries forward as-is. Its actual pricing pattern ("Get a Quote" via WhatsApp) and its motion design (hero roll-in, wheel carousel, parallax road scene) **are** the accepted direction.
- No application code exists: no Next.js project, no Supabase project, no schema, no real components.

Nothing below starts until the blocking items in `INFO_NEEDED.md` are resolved (product/service list, final role sign-off, real branch details).

## v0.1 — Foundations

- Initialize the Next.js (App Router, TypeScript) project and its Cloudflare Workers deployment pipeline via `@opennextjs/cloudflare` (see `ARCHITECTURE.md` ADR-01 — not Cloudflare Pages, which can't serve SSR).
- Initialize the Supabase project: schema migrations for Product, Service, Category, Vehicle, QuoteRequest, Order, ServiceBooking, Review, Wishlist, StaffUser, Branch (single row).
- Supabase Auth setup; Admin/Manager/Cashier roles; baseline Row-Level Security policies.
- Design tokens implemented in Tailwind config (colors, type scale, spacing) per `DESIGN.md`.
- Shared UI primitive library started (`/components/ui`) per `CODE_STANDARDS.md` — no feature UI yet, just the building blocks.
- Seed script with realistic placeholder data (clearly marked as seed data).

**Exit criteria:** a deployed, empty-but-real app; schema and auth functional; component library has its first primitives; nothing hardcoded.

## v0.2 — Catalog (Read Path)

- Product and service listing pages, category browsing, search, vehicle filter — all reading real data from Supabase (seeded).
- Product and service detail pages, including the "Get a Quote" action (UI only at this stage — see v0.3 for the logged request).
- Additional page prototypes needed here (product detail, service detail) if not already covered by the reference prototype — see "Additional Prototypes" below.

**Exit criteria:** a visitor can browse the full catalog and open any product/service detail page, with real data, no placeholder content in the code itself.

## v0.3 — Quote System

- `QuoteRequest` creation wired to the "Get a Quote" action: opens WhatsApp **and** logs the request.
- Staff quote queue in the admin dashboard: view new requests, record an agreed price, mark responded/accepted/declined.
- Customer-facing quote history on their account.

**Exit criteria:** a real quote can be requested, logged, responded to by staff, and seen by the customer — end to end, no mock data.

## v0.4 — Service Booking

- Booking form (vehicle, service, preferred date) wired to `ServiceBooking`.
- Staff booking queue with status transitions (Scheduled → In Progress → Complete).

**Exit criteria:** a booking can be made and progressed through its full lifecycle by staff.

## v0.5 — POS & Inventory

- POS interface: search/select item, checkout, automatic stock deduction from the single stock pool.
- Cost price / sell price / margin tracking, visible to Admin only.
- Daily/monthly sales and margin reporting (Manager sees sales/revenue only).
- Full enforcement of Admin/Manager/Cashier permission boundaries via RLS.

**Exit criteria:** a real in-shop sale can be processed, stock and margin update correctly, and each role sees exactly what it should.

## v0.6 — Customer Accounts & Secondary Features

- Customer auth (sign up/login), persisted wishlist, "My Vehicle" saved profiles.
- Product comparison tool.
- Reviews and ratings, real submissions tied to real customers.

**Exit criteria:** a returning customer's saved data and reviews genuinely persist and affect what they see.

## v0.7 — Payments & Fulfillment

- M-Pesa integration (both Paybill and Till configured, single active-channel toggle in admin).
- Payment against an accepted quote, and pickup/delivery selection at that step.

**Exit criteria:** a customer can pay for an accepted quote via M-Pesa (whichever channel is active) or select pay-in-shop, and choose pickup or delivery.

## v0.8 — Automated Notifications

- WhatsApp Cloud API integration (assuming Meta verification, started back in v0.1, has cleared) for automated order/booking/quote status messages.
- Fallback plan (email or continued manual WhatsApp) if verification is still pending at this point.

**Exit criteria:** status changes trigger real automated messages, not manual staff typing.

## v0.9 — SEO & AI Engine Optimization

- Structured data (schema.org) across product, service, and business pages.
- Sitemap, meta tags, plain-language answerable content pass.
- Performance pass (Core Web Vitals).

**Exit criteria:** the site is technically ready for indexing and AI-answer-engine discovery — actual submission happens at launch.

## v1.0 — Production Launch

- Full QA pass: cross-device, cross-browser, accessibility audit, RLS/security review.
- Real content loaded (actual product/service catalog, real branch details, any real business statistics — no placeholders remaining anywhere).
- Domain live, SSL confirmed, monitoring in place.
- Google Search Console submission.

**Exit criteria:** this is the real, live product a customer can use end to end, and nothing in it is a mock.

## Post-v1.0 — Growth

- Paid ad campaigns (Google/Meta), started once the client is ready.
- Ongoing/competitive SEO and AI EO refinement.
- Any features not in the confirmed v1 set, based on real usage feedback.

---

## Additional Prototypes for Missing Pages

The existing prototype only covers the homepage/catalog-grid view. Pages without a visual reference yet: product detail (with the "Get a Quote" action), service detail + booking form, the quote/account history view, the warranty page, and the entire internal staff/POS/admin surface (a fundamentally different, utilitarian design language from the public site).

**Recommended approach:** rather than hand-building these as raw HTML here, have Claude Code generate them using its installed `imagegen-frontend-web` (and `imagegen-frontend-mobile` for key mobile flows) skill for visual comps, matching the established palette and motion language, then use `image-to-code` to turn the approved comps into real components as part of v0.2 (customer-facing pages) and v0.5 (staff/admin, which should look deliberately distinct — a utility dashboard, not a marketing page). This keeps prototype generation inside the same toolchain that will build the real thing, rather than duplicating effort between this chat and Claude Code.

If a hand-built HTML reference is wanted for a specific page before that point, say which page and it can be produced directly.

## Working Note

At every version, use the Claude Code skill appropriate to the task (see `CLAUDE.md` for the full mapping) and follow `CODE_STANDARDS.md` without exception. Each version ends with Simon reviewing and testing the actual running build before the next version starts.
