# WELL LUPS AUTO TYRES LIMITED — Platform

A custom-built web platform for a two-branch tyre and auto-parts retailer that also performs on-request garage services. The platform unifies an e-commerce storefront, a service-booking flow, and a staff-facing point-of-sale system with per-item margin tracking, under one brand-consistent, original design.

## Documentation

| Document | Contents |
|---|---|
| [`PRD.md`](./PRD.md) | Product requirements — goals, users, functional and non-functional requirements, confirmed feature set |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System architecture — components, data model, integrations, security |
| [`TECH_STACK.md`](./TECH_STACK.md) | Concrete technology choices, tooling, and hosting |
| [`DESIGN.md`](./DESIGN.md) | UX principles, site map, page-level design, design system foundations |
| [`ROADMAP.md`](./ROADMAP.md) | Build sequence and phase gates |
| [`CLAUDE.md`](./CLAUDE.md) | Context file for AI-assisted development sessions |
| [`INFO_NEEDED.md`](./INFO_NEEDED.md) | Information still required from the client |

## Snapshot

- **Business:** two branches, sells tyres/parts, performs garage services on request
- **Platform:** unified goods + services catalog, cart + checkout, service booking, staff POS, margin tracking, customer accounts
- **Frontend:** Next.js on Cloudflare Pages — clean, modern, creative, professional execution, not a templated storefront
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Status:** planning complete for confirmed scope; several data and configuration items are still pending from the client — see `INFO_NEEDED.md`

## Reading order

For anyone new to the project: `PRD.md` → `ARCHITECTURE.md` → `TECH_STACK.md` → `DESIGN.md` → `ROADMAP.md`. `CLAUDE.md` is the working context file to keep open during AI-assisted build sessions.
