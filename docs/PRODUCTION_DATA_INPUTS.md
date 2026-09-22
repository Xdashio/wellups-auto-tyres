# Production data inputs — for Simon to complete

How to use: replace every `[...]` box with the real value. Leave a box as
`[NOT SUPPLIED]` only when that item is intentionally deferred — never invent
a value, and never copy an example. Boxes are deliberately unmistakable so
filled-in data can never be confused with placeholders.

Field rules come from `docs/PRODUCTION_DATA_CONTRACT.md` (the contract wins
on any disagreement). Loading procedure: `supabase/production/README.md`.

---

## A. BRANCH IDENTITY (exactly one operational branch)

| # | Field | Value (Simon fills in) |
|---|---|---|
| A1 | Official branch display name | [ENTER REAL BRANCH NAME — do NOT confirm "Industrial Area" unless it is the real name] |
| A2 | Physical address (as shown to customers) | [ENTER REAL ADDRESS, or NOT SUPPLIED] |
| A3 | Primary phone number | [ENTER REAL PHONE, or NOT SUPPLIED] |
| A4 | WhatsApp number (for quote links) | [ENTER REAL WHATSAPP, or NOT SUPPLIED] |
| A5 | Opening days/hours (free text) | [ENTER REAL HOURS, or NOT SUPPLIED] |
| A6 | Branch active? | [YES / NO] |

Rules: Kenyan phone/WhatsApp accepted in `07...`, `254...`, or `+254...`
shape (validated for shape only once supplied). No invented hours.

## B. PRODUCT CATALOG

Copy the table below — one row per real launch product. Every column is
required except where marked optional. Status must be one of: `active`,
`in_stock`, `low_stock`, `out_of_stock`. Names must NOT start with `SEED `.
SKUs must be unique (used as the load key — duplicates are rejected).

| Product Name | SKU | Category | Brand (opt) | Size/Spec (opt) | Sell Price KES | Cost Price KES | Opening Stock | Branch | Active |
|---|---|---|---|---|---|---|---|---|---|
| [ENTER REAL PRODUCT NAME] | [ENTER REAL SKU] | [ENTER CATEGORY — must match Section D] | [ENTER BRAND or LEAVE BLANK] | [ENTER SIZE e.g. 265/65R17 or LEAVE BLANK] | [ENTER REAL SELL PRICE] | [ENTER REAL COST PRICE] | [ENTER REAL OPENING STOCK NUMBER] | [single branch — bound automatically] | [YES / NO] |

Stock-model note: the schema binds every product to the single branch
(`branch_id` NOT NULL) and tracks an exact quantity that drives the
In/Low/Out badge. See decision Q1 below if that model is wrong.

## C. SERVICE CATALOG

One row per real launch service. Services are global (no branch link) and
carry no price by design. There is no duration field in the schema — do not
supply one.

| Service Name | Description | Vehicle Types | Availability | Active |
|---|---|---|---|---|
| [ENTER REAL SERVICE NAME] | [ENTER REAL DESCRIPTION — no invented credentials or claims] | [ENTER APPLICABLE TYPES e.g. Sedan, SUV, Pickup, Van] | [AVAILABLE / PAUSED] | [YES / NO] |

## D. CATEGORIES (current: Tyres, Alloy Wheels, Batteries, Brake Parts, Filters, Engine Oil & Fluids)

| # | Decision per category | Value |
|---|---|---|
| D1 | Tyres | [KEEP / RENAME TO: ... / REMOVE] |
| D2 | Alloy Wheels | [KEEP / RENAME TO: ... / REMOVE] |
| D3 | Batteries | [KEEP / RENAME TO: ... / REMOVE] |
| D4 | Brake Parts | [KEEP / RENAME TO: ... / REMOVE] |
| D5 | Filters | [KEEP / RENAME TO: ... / REMOVE] |
| D6 | Engine Oil & Fluids | [KEEP / RENAME TO: ... / REMOVE] |
| D7 | New categories needed | [LIST ANY, or NONE] |
| D8 | Category descriptions (all currently read "SEED placeholder") | [SUPPLY FINAL DESCRIPTIONS or CONFIRM GENERIC] |

## E. FITMENT TAXONOMY (12 makes / 8 models / 9 verified specs in `seed_v0.2.sql`)

| # | Decision | Value |
|---|---|---|
| E1 | Keep the existing Kenya-market fitment reference data? | [KEEP AS REFERENCE / EDIT (describe how) / REMOVE] |

This data is reference only (fitment filtering) — never presented as inventory.

## F. STAFF / ROLE SIGN-OFF (roles locked: Admin, Manager, Cashier — NO Owner role)

| # | Field | Value |
|---|---|---|
| F1 | Admin — real person name + login email | [ENTER NAME + EMAIL, or NOT SUPPLIED] |
| F2 | Manager — real person name + login email | [ENTER NAME + EMAIL, or NOT SUPPLIED] |
| F3 | Cashier — real person name + login email | [ENTER NAME + EMAIL, or NOT SUPPLIED] |

No accounts are created from this document. Test accounts (`*@test.local`)
are development-only and never become production staff.

## G. WARRANTY / RETURNS

| # | Field | Value |
|---|---|---|
| G1 | Exact warranty wording (or NOT IN LAUNCH SCOPE) | [ENTER APPROVED WORDING or NOT IN LAUNCH SCOPE] |
| G2 | Warranty scope + exclusions | [ENTER or NOT APPLICABLE] |
| G3 | Returns/exchange wording | [ENTER APPROVED WORDING or NOT IN LAUNCH SCOPE] |

Do not approve drafted copy you have not written — paste only final wording.

## H. DOMAIN

| # | Field | Value |
|---|---|---|
| H1 | Production domain | [ENTER DOMAIN or NOT DECIDED] |
| H2 | www preference | [WWW / NON-WWW / UNDECIDED] |
| H3 | Temporary staging/preview domain needed? | [YES / NO] |

No domain is registered or configured by the implementation team.

## I. M-PESA (display/config only — v0.7 online payment is OUT of launch scope)

| # | Field | Value |
|---|---|---|
| I1 | Show M-Pesa details at launch? | [YES / NO] |
| I2 | Active channel | [PAYBILL / TILL / NOT CONFIGURED] |
| I3 | Official Paybill number (5–7 digits) | [ENTER NUMBER or NOT SUPPLIED] |
| I4 | Official Till number (5–7 digits) | [ENTER NUMBER or NOT SUPPLIED] |
| I5 | Paybill account reference, if applicable | [ENTER or NOT APPLICABLE] |
| I6 | Confirm: nothing at launch claims online payment works | [CONFIRMED / NOT CONFIRMED] |

---

## Required vs optional summary

| Input | Required for launch? | Status | Who supplies | Notes |
|---|---|---|---|---|
| A1 branch name | REQUIRED | MISSING | Simon | Replaces placeholder everywhere |
| A2–A5 address/phone/WhatsApp/hours | REQUIRED if public-facing | MISSING | Simon | NULL-safe; rendered only when set |
| A6 active decision | REQUIRED | MISSING | Simon | Trivial once A1 known |
| B product rows | REQUIRED | MISSING | Simon | Table above; no SEED-prefix names |
| C service rows | REQUIRED | MISSING | Simon | Table above; descriptions must be real |
| D categories decision | REQUIRED | REQUIRES DECISION | Simon | Keep/rename/remove + descriptions |
| E fitment retention | NOT REQUIRED FOR LAUNCH | REQUIRES DECISION | Simon | Safe to defer; reference-only |
| F role sign-off | REQUIRED | MISSING | Simon | Real people + emails; no account creation here |
| G warranty scope | REQUIRED (scope answer) | MISSING | Simon | "NOT IN LAUNCH SCOPE" is a valid answer |
| H domain | REQUIRED | MISSING | Simon | Blocks production URL, not build |
| I1–I6 M-Pesa config | REQUIRED (answers) | MISSING | Simon | "NOT CONFIGURED" valid; display-only |

## Business decision questions for Simon (numbered)

1. **Stock model**: confirm single pooled stock at the one branch (schema assumption), or describe the real model.
2. **Category names**: keep/rename/remove the six generics; supply final descriptions.
3. **Fitment retention**: keep/edit/remove the 9 reference fitments.
4. **Role sign-off**: name the real Admin/Manager/Cashier (people + login emails).
5. **Warranty scope**: final wording, or explicitly out of launch scope.
6. **Domain**: production domain + www preference (+ staging need).
7. **Payment claims**: confirm nothing at launch implies online payment; supply M-Pesa display config or mark not-configured.
8. **Branch identity**: A1–A6 above.
9. **Catalog data**: tables B and C above, completed with real values.
