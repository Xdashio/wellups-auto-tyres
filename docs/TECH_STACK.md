# Tech Stack
## WELL LUPS AUTO TYRES LIMITED — Platform

## Frontend

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | Server-side rendering for SEO/AI EO, type safety across a large feature set — deployed via OpenNext to Cloudflare Workers rather than Pages, since Pages cannot serve SSR (see `ARCHITECTURE.md` ADR-01) |
| Styling | Tailwind CSS | Fast, consistent implementation of a custom design system without fighting a component library's defaults |
| UI primitives | Radix UI (unstyled, accessible primitives) | Accessibility handled correctly by default, fully restyleable to a distinctive visual identity — avoids the "generic component library" look |
| Motion | Framer Motion | Used deliberately for polish (page transitions, micro-interactions) — not decoration for its own sake |
| Forms | React Hook Form + Zod | Type-safe validation for checkout, booking, and admin forms |
| State/data fetching | Supabase JS client + React Server Components where applicable | Minimal client-side state; server-rendered where possible for performance and SEO |
| Icons | Lucide | Consistent, lightweight icon set |

## Backend

| Layer | Choice | Rationale |
|---|---|---|
| Database | Supabase (Postgres) | Relational integrity for products, orders, bookings, and reporting |
| Auth | Supabase Auth | Customer accounts and staff logins, with role claims for Admin / Owner / Cashier |
| Storage | Supabase Storage | Product and service images |
| Custom logic | Supabase Edge Functions (Deno) | Payment webhooks, notification triggers, margin/stock calculations |
| Access control | Postgres Row-Level Security (RLS) | Enforces role- and branch-based data visibility at the database layer, not just in application code |

## Integrations

- **M-Pesa** — STK Push / Paybill or Till, processed via an Edge Function
- **WhatsApp Business API** — automated notifications, triggered via Edge Functions
- **Google Search Console** — indexing and sitemap submission

## Hosting & Deployment

- **Frontend:** Cloudflare Workers, via `@opennextjs/cloudflare` — full SSR/RSC support for SEO/AI EO. Pages serves static exports only and cannot host a server-rendered App Router app.
- **Backend:** Supabase (managed)
- **Domain & DNS:** Cloudflare (once domain is registered)
- **CI/CD:** Git-based deployment — pushes to the main branch deploy to Cloudflare Workers via `wrangler deploy`; preview deployments for feature branches. Requires `wrangler.toml` with `nodejs_compat` enabled.

## Development Tooling

- **Language:** TypeScript throughout, frontend and Edge Functions
- **Package manager:** to be confirmed (pnpm recommended for speed and disk efficiency)
- **Linting/formatting:** ESLint + Prettier
- **Testing:** to be confirmed based on team preference — Vitest for unit tests, Playwright for end-to-end flows (checkout, booking) is the standard modern pairing for this stack

## Explicitly Not Used

- No CMS or e-commerce plugin platform (e.g. WordPress/WooCommerce) — this is a fully custom build.
- No separate Node/Express/NestJS API service — custom backend logic runs in Supabase Edge Functions to keep the system on one platform.
- No multi-currency handling — single currency (KES).
- No multi-branch stock logic — single branch, single stock pool.

## Component & Code Architecture

See `CODE_STANDARDS.md` for the binding rules on component structure, folder layout, schema principles, and testing — in particular the "no God components" constraint that governs every layer of this stack.
