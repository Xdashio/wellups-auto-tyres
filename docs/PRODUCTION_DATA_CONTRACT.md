# Production data contract — inputs required from Simon

> GATE 016C REBASELINE (2026-09-22): the gating model changed. The production
> system no longer waits for every future input. Status today:
> - RESOLVED: branch identity (applied live 2026-09-22, values below).
> - CONFIGURABLE LATER via Admin UI: products, services, categories,
>   fitments, staff accounts, warranty content, domain, M-Pesa display.
> - Rule: REAL DATA WHEN AVAILABLE. EMPTY DATA WHEN NOT AVAILABLE.
>   NEVER FABRICATED DATA. SEED/demo rows must never read as inventory.
>
> Original rule preserved: no values below may be filled with guesses.
> Placeholders use `<ANGLE_BRACKETS>`; realistic-looking fakes are forbidden.

## BRANCH (exactly one operational branch) — SUPPLIED 2026-09-22

| Field | Value | Notes |
|---|---|---|
| Branch name | Greenspan Mall, Donholm | Normalized from Simon's "donholm Greenspan mall at shell petrol station" (capitalization + field split only; no new facts) |
| Address | Shell Petrol Station, Greenspan Mall, Donholm | Simon's words, reordered |
| Phone | +254 719 322835 | As supplied |
| WhatsApp | +254 719 322835 | As supplied; deep-link helper strips non-digits |
| Opening hours | NULL (not supplied) | Rendered only when set |
| M-Pesa | NULL (not supplied) | Display/config only; v0.7 payments out of scope |

Applied live via `admin_update_branch_settings` RPC (admin role, validated).
Set via Admin Settings UI (RPC-validated) once known. Never by hand SQL.

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

## PRODUCT (per real product) — CONFIGURABLE LATER via Admin catalog UI

> GATE 016C: no launch products supplied yet. Public catalog is EMPTY
> (SEED rows retired 2026-09-22; admin history preserved). Add rows through
> Admin Products when Simon supplies them; loader: `supabase/production/`.

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

## SERVICE (per real service) — CONFIGURABLE LATER via Admin services UI

> GATE 016C: no launch services supplied yet. Public list is EMPTY
> (SEED rows retired 2026-09-22; admin history preserved).

| Field | Required? | Notes |
|---|---|---|
| Name | REQUIRED, unique-ish | Must NOT start with `SEED ` |
| Description | REQUIRED | Replaces credentialed fallbacks; no invented claims |
| Vehicle types | REQUIRED | Array (e.g. Sedan, SUV, Pickup, Van) |
| Availability | REQUIRED | `true` = public; `false` = hidden but re-enableable |

Services are global (no branch_id) and carry no price by design.

## DECISIONS (Simon)

> GATE 016C: only decision 4 (partial: test accounts exist, real people
> pending) and 7 (M-Pesa unconfigured, no payment claims made) still gate
> anything. Items 1–3, 5–6 are answerable incrementally through the Admin UI
> or later gates and no longer block the software baseline.

1. Stock model: single pooled stock at the one branch (schema assumes this) — confirm (configurable interpretation; doesn't block baseline).
2. Category names: keep the 6 generic names or rename? (Descriptions currently say `SEED placeholder` — rewrite or confirm; Admin-editable later.)
3. Vehicle fitment taxonomy (12 makes / 8 models / 9 specs from `seed_v0.2.sql`): keep as reference? (Reference-only; doesn't block baseline.)
4. Role sign-off: who is Admin / Manager / Cashier (real people + login emails)? (Test accounts exist; real provisioning later.)
5. Warranty/returns wording and whether a warranty page is in launch scope. (Unpublished until approved.)
6. Domain for production Worker. (Configure later.)
7. Pay-in-shop vs M-Pesa: no payment flow exists yet — confirm nothing at launch claims otherwise. (No such claim in UI after GATE 013 copy fix.)

## Loading procedure

`supabase/production/README.md` — retire SEED rows, load reviewed catalog file, verify public views, set branch identity via Admin UI.
