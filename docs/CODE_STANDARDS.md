# Code & Architecture Standards
## WELL LUPS AUTO TYRES LIMITED — Platform

This is a hard constraint on how the codebase is built, not a style preference. Any AI agent or developer working on this repository follows this document without exception.

## 1. No God Components

A "God component" is any file that mixes two or more of: data fetching, business logic/calculations, state orchestration, and presentation — especially a page file that does all four. This is explicitly disallowed.

**Instead, split by responsibility:**

- **Presentational components** — pure UI, receive data and callbacks as props, contain no data fetching and no business logic. Small and composable (a product card, a stock badge, a quote-status pill).
- **Server components / data access** — fetch data (via typed Supabase queries), pass it down. No inline business rules here beyond shaping the query.
- **Hooks** — encapsulate client-side state and interaction logic (e.g. `useWishlist`, `useQuoteRequest`, `useVehicleFilter`). A hook does one thing.
- **Services / lib layer** — business logic and calculations that aren't UI-specific at all (margin calculation, stock deduction rules, quote-expiry logic, M-Pesa channel selection). These are plain, testable TypeScript functions — not buried inside a component or an Edge Function handler.
- **Edge Functions** — thin request/response wrappers that call into the services layer. The Edge Function itself should not contain the actual business logic, only orchestration (validate input → call service → return response), so the same logic is testable independent of the HTTP layer.

**Rule of thumb:** if a component or function is hard to describe in one sentence, it's doing too much. If a page component exceeds roughly 150–200 lines, that's a signal to extract hooks, services, or child components — not a hard limit, but a prompt to check.

## 2. Folder Structure (indicative)

```
/app                      — Next.js App Router routes (thin — compose components/hooks)
/components
  /ui                      — presentational, reusable, no data fetching
  /features/<feature>      — feature-specific composed components (e.g. /features/quote)
/hooks                     — client-side state/interaction logic
/lib
  /services                — business logic (margin, stock, quote, payment-channel selection)
  /supabase                — typed query functions, one module per entity
/types                     — shared TypeScript types, generated from the Supabase schema where possible
/supabase
  /migrations               — schema migrations, one logical change per migration
  /functions                — Edge Functions, thin orchestration only
```

## 3. Schema & Database Principles

- Normalize by default; don't collapse distinct entities (Product, Service, QuoteRequest, Order, ServiceBooking) into one catch-all table.
- Every table that needs role- or ownership-based visibility gets an explicit Row-Level Security policy — access control lives in the database, not just in application code.
- Migrations are incremental and named for what they do (`002_add_quote_requests.sql`, not `002_update.sql`).
- No business logic in database triggers unless there's a specific integrity reason (e.g. stock cannot go negative) — most logic belongs in the services layer, where it's easier to test and reason about.

## 4. API / Data Access

- No raw Supabase client calls scattered through UI components — data access goes through the typed query functions in `/lib/supabase`.
- Input validation (Zod schemas) at every boundary: forms, Edge Function handlers.
- Errors are handled explicitly and surfaced meaningfully to the user — no silent failures, no generic "something went wrong" without a way to actually understand what happened during development.

## 5. Frontend Component Rules

- One component, one job. A `ProductCard` renders a product; it does not also manage a wishlist API call inline — that's a `useWishlist` hook it calls into.
- Shared UI primitives (buttons, inputs, modals, badges) live in `/components/ui` and are the *only* building blocks — no one-off styled elements duplicating what already exists there.
- No prop-drilling through more than 2–3 levels — reach for composition or a small context/hook instead.

## 6. Testing Expectations

- Services-layer logic (margin calculation, stock deduction, quote-channel selection) is unit tested — this is exactly the kind of logic that's cheap to test in isolation and expensive to get wrong in production.
- Critical flows (checkout, quote submission, booking submission) get end-to-end coverage.
- No feature is marked complete without empirical verification (tests passing, manual check against the acceptance criteria in `PROMPT_PACK.md`) — not just "the code looks right."

## 7. What "Real, Not Mocked" Means in Practice

- No hardcoded product/service/pricing data in components — everything real comes from Supabase, seeded with realistic placeholder data only until the client's actual catalog arrives, and clearly marked as seed data in the seeding script (not invented inline in JSX).
- No fabricated business claims (review counts, years in operation, ratings) anywhere in shipped copy unless the client has actually confirmed the figure.
- The static prototype (`prototype/`) is reference only, per `DESIGN.md` §4 — never copy its hardcoded content into the real app.
