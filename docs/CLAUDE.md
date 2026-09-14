# CLAUDE.md
## Context file for AI-assisted development — WELL LUPS AUTO TYRES LIMITED Platform

This file is for Claude Code (or any AI coding agent) working on this repository. Read this first, then the specific document relevant to the task at hand.

## Project Summary

Custom web platform for a two-branch tyre/auto-parts retailer that also offers on-request garage services. Unified goods + services catalog, cart/checkout with M-Pesa, service booking, staff POS with per-item margin tracking, and role-based access (Admin / Owner / Cashier).

Full requirements: `PRD.md`. Architecture: `ARCHITECTURE.md`. Stack details: `TECH_STACK.md`. Visual/UX direction: `DESIGN.md`. Build order: `ROADMAP.md`. Outstanding client inputs: `INFO_NEEDED.md`.

## Stack (see `TECH_STACK.md` for full detail)

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Radix UI, Framer Motion — deployed to Cloudflare Pages
- **Backend:** Supabase — Postgres, Auth, Storage, Edge Functions (Deno)
- **No CMS, no separate Node API service** — all custom logic lives in Edge Functions

## Working Conventions

- TypeScript everywhere, strict mode on.
- Server Components by default; use Client Components only where interactivity requires it.
- All database access respects Row-Level Security — never bypass RLS with a service-role key from client-facing code.
- Design system components (once built per `DESIGN.md` §3) are the only building blocks for UI — no one-off styled elements outside the system.
- Follow the build order in `ROADMAP.md`; do not start frontend work on a feature before its backend/schema piece exists.

## Brand Colors (Tailwind theme tokens)

```
primary:        #045CB4
primary-dark:   #043D8B
navy:           #144177
blue-muted:     #658EBE
background:     #F1F0EF
text-primary:   #1A1B1B
text-secondary: #777878
```

Full rationale in `DESIGN.md` §3. Do not introduce new blues outside this set without updating that document first.

## Data Model Reference

See `ARCHITECTURE.md` §3 for the full model. Core entities: `Product`, `Service`, `Category`, `Vehicle`, `Order`, `ServiceBooking`, `Review`, `Wishlist`, `StaffUser`, `Branch`.

## Installed Claude Code Skills

<!-- Simon: list installed skills below, one per line — name plus when to invoke it. Once filled in, this becomes the reference for every future session. -->

| Skill | Use for |
|---|---|
| _(pending — to be listed)_ | _(pending)_ |

**Instruction for any AI agent working in this repo:** before starting a task, check this table for a skill that matches the task type (schema/migration work, component scaffolding, test writing, documentation, code review, etc.) and use it rather than working unassisted where a matching skill is installed. If no skill matches, proceed normally per the conventions above.

## Open Items

Do not assume answers to anything listed in `INFO_NEEDED.md` — flag it back to the human rather than guessing, particularly the stock-pooling model, which directly affects schema design.
