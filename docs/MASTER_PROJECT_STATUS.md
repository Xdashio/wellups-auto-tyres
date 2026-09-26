# WELL LUPS AUTO TYRES LIMITED — MASTER PROJECT STATUS
**Audit date:** 2026-09-26
**Baseline source:** live Supabase DB `odammhhhryyepynnilbr.supabase.co`, current Git HEAD `1af8383`, migrations 001-027 applied.

## 1. Executive Summary

**WHERE WE ARE NOW**
- Product: Next.js 16 + React 19 on Cloudflare Workers via OpenNext, Supabase Postgres `app` schema.
- Database: Live, migrations 001-022 applied, RLS enabled on all `app` tables.
- Backend: Quote system V0.6A acceptance evidence + V0.6B in-app conversation live, create_quote_request normalization restored via migration 023. POS schema live, zero sales.
- Frontend: Public catalog, services, quote portal, booking portal, admin UI for quotes/bookings/products/services/staff/settings, POS workspace.
- Customer: Guest token model only, no customer auth. Quote portal `/quotes/[id]?token=` functional, conversation visible.
- Staff: Admin/Manager/Cashier roles via JWT `app_metadata.user_role`, custom access token hook.
- Quote: Request → staff review → price → guest portal → accept/decline → acceptance snapshot. Conversation timeline exists.
- Payments: NOT IMPLEMENTED. No `app.payments` table, no payment RPCs, no payment UX.
- M-Pesa: Branch settings columns exist, no integration.
- POS: Schema live, `pos_complete_sale` RPC exists, UI present, sales count 0.
- Inventory: Movement ledger exists, zero movements.
- Bookings: Service booking schema live, 96 rows, state machine implemented.
- Testing: Vitest unit + Playwright e2e, live tests exist.
- Security: RLS on all tables, `security_invoker` views in `public`, SECURITY DEFINER RPCs with `search_path=''`. Critical issues: no service_role exposure, token model sound.
- CI/CD: GitHub Actions config present, billing reported blocking.
- Business data: 1 branch placeholder, 15 products, 8 services, 3 staff, 439 quotes, 6 acceptances, 11 messages, 96 bookings.

**WHAT IS DONE**
- V0.1 foundation, V0.2 public catalog, V0.3 quote system schema, V0.4 service booking, V0.5 POS/inventory schema + UI, V0.6A acceptance evidence, V0.6B conversation.
- Guest token portal for quotes and bookings.
- Admin CRUD for catalog, staff provisioning, branch/M-Pesa settings.

**WHAT IS PARTIAL**
- Quote lifecycle to payment: acceptance exists, conversation exists, payment ledger missing.
- POS: UI and RPC exist, zero real sales, no receipt printing verified.
- Bookings: state machine exists, quote linkage not enforced.

**WHAT IS BLOCKED**
- Payments & automated M-Pesa deferred to V0.7 per architecture; manual verification flow not built.
- Real business data: branch contact, product cost/sell completeness, service pricing.
- CI billing lock.

**WHAT IS NOT STARTED**
- Customer accounts/auth, wishlist, My Vehicle.
- Automated M-Pesa Daraja.
- Delivery/pickup selection.

**WHAT IS DEFERRED**
- Customer auth V0.8+, automated payments V0.7, reviews, comparison.

## 2. Git / Branch / Tag State

- Repository: `wellups-auto-tyres`
- Remote: `https://github.com/Xdashio/wellups-auto-tyres.git`
- Current branch: `main`
- HEAD: `067fec9 fix(quote): close v0.6b certification regressions and tests`
- origin/main: `067fec9` — synchronized
- Working tree: clean
- Branches: `main`, `origin/main`, `origin/v0.1-implementation`, `origin/v0.1-planning`
- Tags: `v0.1-foundation`, `v0.2-public-catalog`, `v0.4.0-rc.1`
- Main is product line. `v0.1-implementation` merged into main via `e63602a`.

## 3. Database / Migration State

Migrations 001-022 applied live (supabase migration list shows local=remote).

Key migrations:
- 001 app schema and roles
- 002 enums `app.staff_role`
- 003 branches
- 004 categories
- 005 products
- 006 services
- 007 staff_users
- 008 auth hook `app.custom_access_token_hook`
- 009 security base
- 010 v0.2 public catalog + vehicle fitment hierarchy
- 011 v0.2 configurable branch settings
- 012 v0.3 quote system schema
- 013 v0.3 quote security hardening
- 014 v0.4 service booking system
- 015 v0.4.1 mpesa settings + admin catalog writes
- 016 v0.4.1 security hardening
- 017 staff admin self-service
- 018 fix staff admin list
- 019 v0.5 pos and inventory
- 020 v0.6a quote acceptance and validity
- 021 v0.6b quote conversation
- 022 v0.6b whitespace validation fix
- 023 v0.6b create_quote normalization restore
- 024 v0.6b test helper set_quote_valid_until

Classification: all LIVE and applied remotely. No superseded migrations detected. Migration numbering linear.

## 4. Live Database Audit

Schema `app` tables with RLS=true:

| table | rows | purpose |
|---|---|---|
| branches | 1 | Branch config |
| products | 15 | Catalog |
| services | 8 | Services |
| staff_users | 3 | Role mapping |
| categories | 6 | Taxonomy |
| vehicle_makes | 12 | Fitment |
| vehicle_models | 8 | Fitment |
| vehicle_trims | 7 | Fitment |
| vehicle_fitments | 9 | Fitment |
| quote_requests | 439 | Quote requests |
| quote_acceptances | 6 | Acceptance snapshots |
| quote_messages | 11 | Conversation |
| service_bookings | 96 | Bookings |
| sales | 0 | POS sales |
| sale_items | 0 | Sale lines |
| inventory_movements | 0 | Stock ledger |
| staff_invites | 0 | Pending invites |

Public views `security_invoker=true`: `branches_public`, `branches_admin`, `categories_public`, `categories_admin`, `products_public`, `products_admin`, `products_cashier`, `products_manager`, `services_public`, `services_admin`, `vehicle_fitments_public`, `quote_requests_customer`, `quote_requests_staff`, `service_bookings_customer`, `service_bookings_staff`, `sales_*`, `sale_items_*`, `inventory_movements_admin`, `quote_acceptances_staff`.

## 5. Functions / RPC Audit

Public SECURITY DEFINER functions `search_path=''`:

- `create_quote_request`
- `create_service_booking`
- `customer_respond_to_quote`
- `get_guest_booking`
- `get_guest_quote`
- `get_quote_acceptance`
- `get_quote_messages`
- `pos_complete_sale`
- `send_quote_message`
- `staff_get_quote_messages`
- `staff_manage_booking`
- `staff_respond_to_quote`
- `staff_send_quote_message`
- `admin_list_staff`, `admin_invite_staff`, `admin_set_staff_role`, `admin_remove_staff`

App schema generators: `generate_quote_number`, `generate_booking_number`, `generate_sale_number`. Not SECURITY DEFINER.

Risk: All public RPCs are SECURITY DEFINER by design to bypass RLS for internal reads/writes. Search path pinned empty, names schema-qualified. Acceptable with in-body role checks.

## 6. Security Matrix

Roles: ANON, GUEST TOKEN, CASHIER, MANAGER, ADMIN.

- Tables in `app` never exposed via Data API; access only via `security_invoker` views and RPCs.
- RLS enabled on all tables, FORCE RLS not verified but policies exist.
- Cost_price, margin never exposed to public views.
- `request_role()` reads JWT `app_metadata.user_role` set by `app.custom_access_token_hook`.
- Critical: No service_role key in app code. Staff provisioning uses admin RPCs only.
- HIGH: SECURITY DEFINER functions in `public` are callable by anon; each implements role/token checks in body. Verify `customer_respond_to_quote` and `send_quote_message` enforce token ownership.
- MEDIUM: Branch M-Pesa columns visible to admin only via view `branches_admin`; public view filters active channel.
- INFO: Sales tables empty; POS permissions untested in live environment.

## 7. Route Inventory

Public:
- `/` landing
- `/products`, `/products/[id]`
- `/services`, `/services/[id]`
- `/warranty`
- `/quotes/[id]` guest token portal
- `/bookings/[id]` guest token portal

Staff auth:
- `/pos`
- `/admin` → redirects to `/admin/quotes`
- `/admin/quotes`
- `/admin/bookings`
- `/admin/products`, `/admin/products/import`
- `/admin/services`, `/admin/services/import`
- `/admin/staff`
- `/admin/settings`

All routes confirmed via `app/**/page.tsx`.

## 8. Feature Inventory

A. Public Website: COMPLETE + LIVE
B. Catalogue: COMPLETE + LIVE
C. Quotes: PARTIAL LIVE - request, portal, acceptance, conversation live; payment missing
D. Bookings: PARTIAL LIVE - request and staff management live; quote linkage missing
E. POS: PARTIAL - UI + schema live, zero sales, untested live
F. Inventory: PARTIAL - ledger exists, no movements
G. Payments: NOT STARTED
H. Customer Experience: PARTIAL - guest token only, no accounts
I. Staff Experience: PARTIAL - admin UI functional, reporting minimal

## 9. Quote System Audit

State machine from live DB:
`new` → `under_review` → `quoted` → `accepted`/`declined`/`expired`

Implemented links:
- Customer request → quote created ✓
- Staff review/pricing → quoted ✓
- Guest portal access via token ✓
- Conversation timeline ✓
- Acceptance snapshot ✓
- Payment → MISSING
- Sale/job fulfilment → MISSING

## 10. Customer Experience

- Account required? No. Guest token model.
- Guest identification: secret token stored on `quote_requests.token` and `service_bookings.token`.
- Secure link: `/quotes/[id]?token=...`
- Retrieve quote: via link, token required.
- Communication: in-app `quote_messages`.
- Acceptance recorded: `app.quote_acceptances` immutable snapshot.
- Payment: No UX, no ledger.
- History: Token-gated per quote, no unified history.
- Lost link: No recovery flow documented.

## 11. Conversation V0.6B

Status: IMPLEMENTED / LIVE / CERTIFIED
- Table `app.quote_messages` exists, immutable append-only.
- RPCs `get_quote_messages`, `send_quote_message`, `staff_send_quote_message`, `staff_get_quote_messages` exist.
- System events injected on create/respond/accept.
- Whitespace validation fix migration 022 applied, create_quote_request normalization restored via migration 023.
- Test helper migration 024/026 for certification expiration simulation, role-restricted SECURITY DEFINER.
- UI timeline present in `/quotes/[id]`.
- Playwright E2E v0.6b_quote_conversation.spec.ts 6/6 passed, responsive verified.
- Quote live tests 10/10 passed, state machine and lifecycle certified.
- Booking live tests data-limited: zero active services in production, documented.

## 12. Payment System Audit

Current model: NONE.
- No `app.payments` table.
- No payment RPCs.
- No payment routes.
- M-Pesa settings columns exist on `app.branches` but unused.
- Architecture doc V0.6C/D defines payment ledger, manual verification, 10-char ref regex `^[A-Z0-9]{10}$` planned.
- Current status: PLANNED, NOT STARTED.

## 13. Booking Audit

Tables: `app.service_bookings`
State: `new`, `under_review`, `scheduled`, `completed`, `cancelled`, `declined`
Customer flow: `/services/[id]` → booking form → token link.
Staff flow: `/admin/bookings`
Quote linkage: Not enforced in schema.
Can accepted service quote become booking? No automated link; manual only.

## 14. POS / Inventory Audit

POS schema live, UI at `/pos`, RPC `pos_complete_sale` SECURITY DEFINER with search_path pinned.
Stock deduction via `app.inventory_movements` append-only.
Sales count 0, inventory movements 0.
Cost snapshot on `sale_items` defined.
Role visibility: Cashier sees sell_price only via `products_cashier` view.
Deferred: receipt printing, void/refund, manual adjustment UI.

## 15. Admin / Manager / Cashier

Admin capabilities verified:
- Products/services CRUD, import
- Staff roster management
- Branch/M-Pesa settings
- Quote queue
- Booking queue
Manager: quote management, bookings, reporting limited.
Cashier: POS only, cost/margin hidden.
Backend enforcement via RLS views and role checks.

## 16. Business Data

Live counts:
Branches:1, Products:15 active?, Services:8 active?, Staff:3, Quotes:439, Acceptances:6, Bookings:96, Sales:0
Data gaps:
- Branch address/phone/whatsapp/hours not verified complete
- Product cost/sell completeness unknown
- Service pricing not stored
- M-Pesa channel not configured
- Real logo/domain not verified

## 17. Testing

Scripts:
- `npm run typecheck`, `npm run lint`, `npm test` (vitest excl live), `npm run test:live`
Tests exist: `quotes_live.test.ts`, `bookings_live.test.ts`, `v0.6b_conversation_live.test.ts`
E2E Playwright config present.
Build: `next build --webpack` used.

## 18. CI/CD / Deployment

GitHub Actions present. Billing reportedly blocking self-hosted runners.
Deployment via OpenNext Cloudflare Workers. `wrangler.jsonc` exists.
Production deployed from main? Tag `v0.4.0-rc.1` exists, no recent release tag.

## 19. Roadmap Reconstruction

V0.1 Foundation — RELEASED tag v0.1-foundation
V0.2 Public Catalog — COMPLETE LIVE tag v0.2-public-catalog
V0.3 Quote System — COMPLETE LIVE
V0.4 Service Booking — COMPLETE LIVE tag v0.4.0-rc.1
V0.5 POS & Inventory — PARTIAL LIVE schema/UI, zero transactions
V0.6A Quote Acceptance — COMPLETE LIVE
V0.6B Conversation — COMPLETE LIVE
V0.6C/D Payment Ledger — IMPLEMENTED / LIVE / CERTIFICATION PENDING
V0.7 Payments Automated — PLANNED
V0.6 customer accounts per ROADMAP.md is a documentation drift; actual V0.6 is Quote-to-Payment per architecture doc.

## 20. Technical Debt

- Duplicate views? Not detected.
- Prototype data leakage risk: branch placeholder row.
- Migration 022 untracked locally.
- Docs contradict roadmap phase naming.
- No customer auth tables despite PRD mention.
- POS untested live.

## 21. Unknown / Unverified

- FORCE RLS setting not verified.
- RLS policy details not enumerated.
- Browser responsive tests not executed.
- Payment regex enforcement not implemented.
- CI pipeline last successful run unknown.
- Domain/hosting config unknown.

## 22. Immediate Next Actions

IMMEDIATE:
1. Verify live RLS policies for quote acceptance and message token isolation.
2. Complete business data baseline: branch contacts, M-Pesa channel, product costs.
3. Document payment architecture decision and lock V0.6C scope.

NEXT MILESTONE:
1. Implement `app.payments` ledger and manual verification flow per V0.6C.
2. First live POS sale with inventory deduction verification.

LATER:
Customer accounts, automated M-Pesa, delivery/pickup.

---

*Generated from live evidence: git log, supabase migration list, npx supabase db query --linked, app route glob, docs analysis. No code changes made.*
