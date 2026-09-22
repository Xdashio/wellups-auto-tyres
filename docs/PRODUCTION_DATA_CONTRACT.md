# Production data contract — inputs required from Simon

No values below are known. Nothing here may be filled with guesses.
Placeholders use `<ANGLE_BRACKETS>`; realistic-looking fakes are forbidden.

## BRANCH (exactly one operational branch)

| Field | Required? | Notes |
|---|---|---|
| Real branch name | REQUIRED | Replaces placeholder `Industrial Area` everywhere |
| Address | REQUIRED if public-facing | NULL-safe today; rendered only when set |
| Phone | REQUIRED if public-facing | Displayed in header/footer when set |
| WhatsApp number | REQUIRED for quote deep-links | Kenyan format; validated only for shape once supplied |
| Opening hours | REQUIRED if public-facing | Free text |
| M-Pesa channel + numbers | REQUIRED before any payment claim | Paybill (5–7 digits) AND/OR Till (5–7 digits), which is active, paybill account ref if applicable. v0.7 payments NOT built — this is display/config data only |

Set via Admin Settings UI (RPC-validated) once known. Never by hand SQL.

## PRODUCT (per real product)

| Field | Required? | Notes |
|---|---|---|
| Name | REQUIRED | Must NOT start with `SEED ` (reserved for demo) |
| SKU | REQUIRED, unique | Natural key for idempotent loads |
| Category | REQUIRED | Must exist (confirm the 6 generic names or supply renames) |
| Cost price (KES) | REQUIRED if margin tracking wanted | Admin-only, never public |
| Sell price (KES) | REQUIRED if used for quotes | Internal; public catalog shows quote-only |
| Stock quantity | REQUIRED | Drives In/Low/Out badge via status |
| Status | REQUIRED | `active` / `in_stock` / `low_stock` / `out_of_stock` |
| Branch | REQUIRED (schema NOT NULL) | All rows bind to the single branch |
| Brand / size spec | OPTIONAL | Displayed when set |

## SERVICE (per real service)

| Field | Required? | Notes |
|---|---|---|
| Name | REQUIRED, unique-ish | Must NOT start with `SEED ` |
| Description | REQUIRED | Replaces credentialed fallbacks; no invented claims |
| Vehicle types | REQUIRED | Array (e.g. Sedan, SUV, Pickup, Van) |
| Availability | REQUIRED | `true` = public; `false` = hidden but re-enableable |

Services are global (no branch_id) and carry no price by design.

## DECISIONS (Simon)

1. Stock model: single pooled stock at the one branch (schema assumes this) — confirm.
2. Category names: keep the 6 generic names or rename? (Descriptions currently say `SEED placeholder` — rewrite or confirm.)
3. Vehicle fitment taxonomy (12 makes / 8 models / 9 specs from `seed_v0.2.sql`): keep as reference?
4. Role sign-off: who is Admin / Manager / Cashier (real people + login emails)?
5. Warranty/returns wording and whether a warranty page is in launch scope.
6. Domain for production Worker.
7. Pay-in-shop vs M-Pesa: no payment flow exists yet — confirm nothing at launch claims otherwise.

## Loading procedure

`supabase/production/README.md` — retire SEED rows, load reviewed catalog file, verify public views, set branch identity via Admin UI.
