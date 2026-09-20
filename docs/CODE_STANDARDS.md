# Code Standards
## WELL LUPS AUTO TYRES LIMITED — Platform

This is the engineering standard every contribution to this repository is held to. It is built from the working conventions in `CLAUDE.md`, the architecture in `ARCHITECTURE.md`, and the visual direction in `DESIGN.md`. When a task conflicts with this document, fix the task or update this document first — never ship the conflict.

## 1. Principles

- **Real infrastructure, not a mockup.** Nothing is hardcoded outside the seed script (`supabase/seed.sql`). Catalog data, pricing, branch details, and service data live in the database.
- **No God components.** Every file has one clear responsibility and stays small enough to hold in context at once.
- **Server first.** Server Components by default; Client Components only where interactivity requires it (`"use client"` is a deliberate decision, not a default).
- **Defense in depth.** Authorization is enforced at the database layer (RLS + grants), never only in application code.
- **TypeScript everywhere.** Strict mode on, no `any` escape hatches in committed code.

## 2. Project Structure

```
/                     repo root — the Next.js application
├── app/              App Router routes (Server Components by default)
├── components/
│   ├── ui/           shared design-system primitives (buttons, fields, badges…)
│   └── …             feature components composed ONLY from ui/ primitives
├── lib/              framework-agnostic helpers (supabase clients, types, constants)
├── supabase/
│   ├── config.toml   Supabase CLI project config
│   ├── migrations/   numbered, append-only SQL migrations
│   ├── seed.sql      the ONLY place placeholder/seed data lives
│   └── tests/        pgTAP RLS test files (one per secured table)
├── docs/             product, architecture, design, standards documents
└── public/           static assets (logo, favicon, brand imagery)
```

- `components/ui/` is the only source of building blocks. Feature components never hand-style a one-off element outside the system (`CLAUDE.md` Working Conventions).
- Feature UI never starts before its backend/schema piece exists (`ROADMAP.md` build order).

## 3. TypeScript Standards

- Strict mode on (`"strict": true`), `moduleResolution: "bundler"`, path alias `@/*` → repo root.
- All runtime data crossing a trust boundary (forms, URL params, webhook payloads) is validated with Zod before use.
- Shared database row types are derived in one place (`lib/database.types.ts`, generated from the Supabase schema) — never re-declared ad hoc per file.
- Prefer `satisfies` over type assertions; prefer discriminated unions over optional-field soup.
- No comments except where a decision is non-obvious; code explains itself.

## 4. Component Standards (no God components)

- One component per file; a file exceeding ~150 lines is split by responsibility before it is extended.
- A component does exactly one of: layout, data-fetching orchestration, presentation, or interaction — not all four.
- Data-fetching orchestration lives in Server Components (or route handlers); presentational/interactive units receive props and stay testable in isolation.
- Naming: `PascalCase.tsx` for components, `camelCase.ts` for helpers, `use-thing.ts` for hooks.
- Props: explicit interface named `<Component>Props`; no `React.FC`; children passed explicitly.
- Every interactive primitive from Radix UI is restyled through the design tokens — accessibility is inherited, appearance is ours.
- Framer Motion is used deliberately (enter/exit, add-to-cart/wishlist feedback, form validation states) — never decorative for its own sake (`DESIGN.md` §3).
- Every page, state (empty/loading/error), and interaction meets the "clean, modern, creative, professional" bar (`DESIGN.md` §1).

## 5. Database Standards

- **Migrations** are numbered, append-only SQL files under `supabase/migrations/`. Never edit an applied migration — write a new one.
- **RLS on every table** in the exposed `public` schema. Grants and policies live in the same migration. Revoke the default blanket grants first, then grant back only what each role needs (per-operation, per-role).
- **One policy per operation** (`for select` / `insert` / `update` / `delete`) — never `for all`. Every policy names its role with `to`.
- **Computed values are generated columns** (e.g. per-item margin), not application-side arithmetic that can drift.
- **Fixed value sets are Postgres enums or `check` constraints** — not free-text columns compared by string.
- **`security definer` functions** live in the `private` schema, pin `set search_path = ''`, schema-qualify every name inside, and are never created in an exposed schema.
- **Indexes** exist on every column a policy filters on (leading column of a btree).
- **Seed data lives only in `supabase/seed.sql`**, clearly marked as seed data at the top of the file. No realistic placeholder data is ever invented inline elsewhere in the codebase.
- Foreign keys are declared with explicit `on delete` behavior; defaults are `set null` for optional references, `restrict` for structural ones.

## 6. Auth & Role Matrix

Roles are Admin / Manager / Cashier (customer accounts are separate, non-staff). Staff role lives in `staff_users.role`. Two layers consume it:

- **RLS policies** read the role from the database via the `private.current_staff_role()` security-definer helper — role changes take effect immediately, with no JWT-staleness window.
- **The custom access token hook** projects `staff_users.role` into each staff JWT as the `app_metadata.staff_role` claim so the app can gate UI — `app_metadata` cannot be modified by the user, so it is a safe place for authorization data.

RLS is the enforcement layer; the JWT claim is a UX convenience only and is never the sole gate for anything sensitive.

| Capability | Admin | Manager | Cashier | Customer | Anon |
|---|---|---|---|---|---|
| Read public catalog fields (products/services/categories, sell-side) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read cost price / margin | ✓ | ✓ | ✗ | ✗ | ✗ |
| Write products / services / categories | ✓ | ✓ | ✗ | ✗ | ✗ |
| Read all orders / bookings / quote requests | ✓ | ✓ | ✓ | ✗ | ✗ |
| Update booking status (queue) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create orders / bookings / quote requests (own) | ✓ | ✓ | ✓ | ✓ | ✗ |
| Read / update own orders, bookings, vehicles, wishlist | ✓ | ✓ | ✓ | ✓ | ✗ |
| Write reviews (own), read reviews | ✓ | ✓ | ✓ | ✓ | ✓ (read) |
| Staff user management | ✓ | ✗ | ✗ | ✗ | ✗ |
| Branch write | ✓ | ✗ | ✗ | ✗ | ✗ |
| Branch read | ✓ | ✓ | ✓ | ✓ | ✓ |

Cost price / margin are enforced at the database layer: the `products` table grants `authenticated` no column-level `select` on cost columns, and a `security definer` RPC in `private` re-exposes cost fields only to staff whose `staff_users.role` is `admin` or `manager`. A cashier therefore cannot reach cost data through the table, the Data API, or the RPC.

**Open items flagged to the client (do not assume):** exact Manager-vs-Admin boundary refinements beyond this baseline; stock-pooling model when the two-branch rollout begins.

## 7. Design Token Rules

- The palette is exactly the set in `DESIGN.md` §2: `primary #045CB4`, `primary-dark #043D8B`, `navy #144177`, `blue-muted #658EBE`, `background #F1F0EF`, `text-primary #1A1B1B`, `text-secondary #777878`.
- No new blues are introduced outside this set without updating `DESIGN.md` first (`CLAUDE.md` Brand Colors).
- Tokens are declared once, in the Tailwind v4 `@theme` block (`app/globals.css`) — components reference tokens via Tailwind utilities, never raw hex values.
- Functional colors (success / error / warning / stock-status) are part of the token set, defined alongside the palette.
- Typography is a two-tier system: a distinctive display face for headings, a highly legible body face — both loaded via `next/font` and swappable through tokens.

## 8. Testing Standards

- **TDD for any logic beyond simple CRUD**: red-green-refactor — the failing test is written and seen to fail before the implementation exists.
- **RLS is verified with pgTAP** under `supabase/tests/` — one file per secured table, asserting allow and deny for `select` / `insert` / `update` / `delete` per role, including all three staff roles (Admin, Manager, Cashier) and customer/anon. Run with `supabase test db`; until it passes, the policies are not known to work.
- **Unit tests**: Vitest for helpers and components with logic.
- **E2E**: Playwright for checkout, booking, and auth flows (from the first flow-bearing version onward).
- Verification commands are run fresh before any success claim — evidence before assertions, always.

## 9. Git & Delivery Conventions

- Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`), one logical change per commit, frequent commits.
- Pushes to `main` deploy to Cloudflare Workers automatically; feature branches get preview deployments.
- Work is verified (build, migrations, RLS tests, seed) before being declared done; a summary of what was built and how to test it accompanies every handoff for review.
