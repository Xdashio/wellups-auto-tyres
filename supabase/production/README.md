# Production data loading — READ THIS FIRST

This directory holds the **mechanism** for loading real business data later.
It contains **no real business data** — every value here is an explicit
`<PLACEHOLDER>`. A file with `<...>` markers is not valid SQL and fails
loudly if executed; that is intentional.

## Current live state (verified GATE 014)

- 1 branch row: name `Industrial Area` (placeholder), all contact fields NULL
- 6 categories with generic names but `SEED placeholder` descriptions
- 15 `SEED-*` products, 8 `SEED-*` services (exact contents of
  `supabase/seed.sql`, deterministic UUIDs)
- 9 verified Kenya-market vehicle fitments (`supabase/seed_v0.2.sql`)

## Files

| File | Purpose | Safe to run? |
|---|---|---|
| `retire-seed-catalog.sql` | Idempotent, transactional retirement of `SEED %` catalog rows (products → `discontinued`, services → unavailable). Preserves rows + FK history. | YES — touches only `SEED %` rows; verified on scratch. Do NOT run until replacement data is ready (it empties the public catalog). |
| `catalog.template.sql` | Placeholder template for real rows. NOT valid SQL until every `<...>` is replaced with supplied business values. Upserts by natural key (`sku` / `name`). | NO — fails loudly by design until completed. |
| `README.md` (this file) | Procedure. | n/a |

## Procedure (when Simon supplies real data)

1. Fill a COPY of `catalog.template.sql` (never edit the template in place
   for a specific load; keep the template pristine).
2. Review the completed file: every `<...>` replaced, SKUs unique,
   `branch_id` resolved from the REAL branch row (by name lookup in the
   template — never invent a UUID).
3. Apply in a transaction against a non-production copy first; verify
   public views show exactly the intended catalog.
4. On the live project, in ONE transaction: run `retire-seed-catalog.sql`,
   then the completed catalog file, then verify counts.
5. Update branch identity via Admin Settings UI (RPC-validated), NOT by hand SQL.
6. Categories: confirm/rename via Admin catalog UI (descriptions currently
   say `SEED placeholder`).

## What this directory must NEVER contain

- Real prices, stock levels, M-Pesa numbers, contacts, or hours unless
  Simon has supplied them in writing.
- Realistic-looking fake values. Placeholders use `<ANGLE_BRACKETS>` only.

## Guards against demo-becoming-production

- `supabase/seed.sql` header declares DEVELOPMENT ONLY.
- `tests/seed_hygiene.test.ts` fails CI if any `seed.sql` product/service
  name lacks the `SEED ` prefix, or if this template ever contains an
  INSERT without a `<...>` marker.
- The retire script matches `name LIKE 'SEED %'` only — it cannot touch
  real rows. Real rows must never use the `SEED ` prefix.
