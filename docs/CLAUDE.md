# CLAUDE.md
## Context file for AI-assisted development — WELL LUPS AUTO TYRES LIMITED Platform

Read this first, then `PRD.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, `DESIGN.md`, `CODE_STANDARDS.md`, and the current version's entry in `ROADMAP.md` before writing any code.

## Project Summary

Custom web platform for a single-branch tyre/auto-parts retailer that also offers on-request garage services. Quote-based pricing (no displayed prices), unified goods + services catalog, service booking, staff POS with per-item margin tracking, and role-based access (Admin / Manager / Cashier).

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Radix UI, Framer Motion — Cloudflare Workers, via `@opennextjs/cloudflare` (ADR-01, `ARCHITECTURE.md` §1 — not Pages, which can't serve SSR)
- **Backend:** Supabase — Postgres, Auth, Storage, Edge Functions

## Non-Negotiables

1. **No God components.** Follow `CODE_STANDARDS.md` exactly — separate presentation, data access, hooks, and business logic. This is a hard rule, not a suggestion.
2. **Nothing hardcoded or mocked in shipped code.** The static prototype (`prototype/welllups.html`) is a **visual/motion reference only** — it hardcodes two branches, invented statistics, and placeholder content. None of that is real. Real implementation always reads from Supabase.
3. **Build like a real engineer, not a demo.** Think through the problem, check the schema and existing code before adding to it, write real tests for real logic, and verify empirically before calling anything done.
4. **Every task starts with a plan**, not straight to code — see the skill table below.

## Installed Skills — When to Use Each

The list below was verified directly against this project's actual skill catalog (62 Hermes-catalog skills) — not assumed. If a skill referenced anywhere in this repo's docs isn't in this table, it doesn't exist here; don't invoke it, and flag the doc that mentions it for correction.

| Skill | Use for |
|---|---|
| `codebase-inspection` | Start of every session touching existing code — understand what's actually there before changing it |
| `spike` | Quick, throwaway technical exploration when an approach is genuinely uncertain (e.g. an M-Pesa or WhatsApp Cloud API integration detail) before committing to it in real code |
| `test-driven-development` | All services-layer logic — margin calculation, stock deduction, quote-lifecycle transitions, payment-channel selection. Write the test first. |
| `systematic-debugging` | Any bug — root-cause first, no guessing fixes |
| `simplify-code` | Directly enforces the no-God-components standard in `CODE_STANDARDS.md` — run this whenever a component or function is doing more than one job |
| `requesting-code-review` | Preparing the PR/summary for Simon at the end of every version |
| `sdlc-review` | A broader process/quality check at major version boundaries (v0.5, v1.0) — not needed for every small change |
| `github` | Any git/GitHub CLI operation against this repo |
| `dogfood` | Actually using the built product as a real customer/staff member would, specifically at v1.0 QA |
| `node-inspect-debugger` | Debugging Node/Edge Function runtime issues specifically |
| `design-taste-frontend` | Primary aesthetic-direction skill for the public storefront and marketing pages |
| `ui-ux-pro-max` | General UI/UX quality pass — pairs with `design-taste-frontend`, not a replacement for it |
| `awesome-design-skill` | Additional design-quality reference when a page isn't landing right |
| `claude-design` | Anthropic's own design conventions — useful as a secondary check |
| `design-motion-principles` | Porting the prototype's motion design (hero roll-in, wheel carousel, parallax road scene) to Framer Motion correctly |
| `imagegen-frontend-web` | Generating comp images for pages with no prototype yet (product detail, quote flow, warranty page, staff/admin dashboard) |
| `design-md` | Useful if `DESIGN.md` itself needs restructuring or a second opinion on its spec format — not for generating new pages |
| `architecture-diagram` | Producing/updating a visual diagram of the schema or system architecture for `ARCHITECTURE.md` if the prose form stops being clear enough |
| `grounded-citations` | When researching current Next.js/Supabase/Cloudflare/OpenNext behavior — cite what was actually found rather than assuming from training data, since these platforms change fast |
| `hermes-agent-skill-authoring` | Only if a genuinely new, project-specific skill is worth creating (as with `wellups-v0.1-planning`) — not for routine work |

**Not applicable to this project:** the `autonomous-ai-agents` category (meta-tools about agents themselves), `email`/`media`/`note-taking`/`social-media`/`web`/`omarchy` categories, most of `productivity` (docx/xlsx/notion/airtable/etc. — this is a codebase, not office work), most of `research` (arxiv/competitor-news-monitor/llm-wiki — not relevant to building this platform), and `python-debugpy` (this stack is TypeScript/Node, not Python).

**Project-specific:** `wellups-v0.1-planning` — created by Claude Code for this project's v0.1 planning. Keep it current as scope evolves; don't let it drift from `ROADMAP.md`.

**Historical note:** an earlier version of this table was built from a skill list that turned out not to match this project's actual catalog. If any other doc in this repo (including `PROMPT_PACK.md`) still references a skill not in the table above, treat that as a bug in the doc, not an instruction to follow.

## Data Model Reference

Full model in `ARCHITECTURE.md` §3. Core entities: `Product`, `Service`, `Category`, `Vehicle`, `QuoteRequest`, `Order`, `ServiceBooking`, `Review`, `Wishlist`, `StaffUser`, `Branch` (single row).

## Open Items

Do not assume answers to anything in `INFO_NEEDED.md` — flag back to Simon rather than guessing, especially the product/service catalog data, which several versions depend on.
