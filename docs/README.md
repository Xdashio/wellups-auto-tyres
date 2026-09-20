# WELL LUPS AUTO TYRES LIMITED — Platform

A custom-built web platform for a single-branch tyre and auto-parts retailer that also performs on-request garage services. Quote-based pricing, a unified goods + services catalog, service booking, and a staff-facing POS with per-item margin tracking — all real, engineered infrastructure, not a mockup.

## Documentation

| Document | Contents |
|---|---|
| [`PRD.md`](./PRD.md) | Product requirements — goals, users, functional requirements, confirmed feature set |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System architecture — components, data model, integrations, security |
| [`TECH_STACK.md`](./TECH_STACK.md) | Concrete technology choices, tooling, hosting |
| [`CODE_STANDARDS.md`](./CODE_STANDARDS.md) | Hard rules on component/schema/API architecture — no God components |
| [`DESIGN.md`](./DESIGN.md) | UX principles, brand palette, site map, design system foundations |
| [`ROADMAP.md`](./ROADMAP.md) | The full version ladder, v0.1 through v1.0 and beyond |
| [`PROMPT_PACK.md`](./PROMPT_PACK.md) | Exact Claude Code prompts, one per version in the Roadmap |
| [`CLAUDE.md`](./CLAUDE.md) | AI-agent context file — stack, non-negotiables, full skill mapping |
| [`INFO_NEEDED.md`](./INFO_NEEDED.md) | Information still required from the client |

## Snapshot

- **Business:** single branch (Nairobi), sells tyres/parts, performs garage services on request
- **Pricing:** quote-based — "Get a Quote," no displayed prices
- **Platform:** unified catalog, quote system, service booking, staff POS, margin tracking, customer accounts
- **Frontend:** Next.js on Cloudflare Workers (via `@opennextjs/cloudflare`) — clean, modern, agency-grade execution
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions)
- **Status:** planning complete for confirmed scope; building begins at v0.1 once blocking items in `INFO_NEEDED.md` are resolved

## Reference Prototype

`prototype/welllups.html` is a **visual and motion reference only** — see `DESIGN.md` §4 and `ARCHITECTURE.md` §1 for exactly what does and doesn't carry forward from it. It is not real data and not real logic.

## Reading order

New to the project: `PRD.md` → `ARCHITECTURE.md` → `TECH_STACK.md` → `CODE_STANDARDS.md` → `DESIGN.md` → `ROADMAP.md`. Building a specific version: open `PROMPT_PACK.md` directly. `CLAUDE.md` stays open during every AI-assisted session.
