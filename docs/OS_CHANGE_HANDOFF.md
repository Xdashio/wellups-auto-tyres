# Well Lups Auto Tyres — OS Change Handoff

Certified pre-OS-change: all important work is on the remote Git repository
(`https://github.com/Xdashio/wellups-auto-tyres.git`). A fresh machine needs
only `git clone` + `npm ci` + `.env.local` (NOT in Git — see below) to
reconstruct the project.

## Current production application line

main:
`8b06ba4` (after handoff commit below — production line, fully green)

## Release candidate

v0.4.0-rc.1:
`b8c435e` (immutable; annotated tag object `6142996`; verified remote)

## Current development branch

v0.1-implementation:
`f29d004` (in sync with origin)

## Release branch

release/v0.4:
`70c3b44` (pushed to origin for the record; frozen)

## Database

Migrations:
001–016 (all present on main; verified via `supabase migration list`
local == remote during GATES 012B–019)

Migration 015:
verified (applied, untouched)

Migration 016:
verified live (applied, untouched)

## Major completed systems

- public website (home, nav, footer, empty states)
- product catalogue (public views + qualitative stock)
- service catalogue
- Admin catalogue (token-scoped server actions, RLS-enforced)
- branch settings (admin-only RPC, M-Pesa shape validation)
- quotes (guest RPC creation, token lookup, staff queue, state machine)
- bookings (guest RPC creation, tracking, staff management, cashier fence)
- role model (Admin/Manager/Cashier via JWT `app_metadata.user_role`)
- RLS/security (app schema boundary, security_invoker views, DEFINER RPCs)
- financial projection controls (tiered views; anon boundaries verified live)
- Cloudflare/OpenNext build (artifact reproduces; NO deploy authorized)
- release workflow (tag CI configured; fail-closed manual release stub)

## Current business configuration

- products/services intentionally empty (15 SEED + 8 SEED retired from
  public; history preserved in admin views)
- real branch identity configured (Greenspan Mall, Donholm + contacts)
- staff provisioning pending (test accounts only)
- warranty pending (unpublished)
- domain pending
- M-Pesa configuration pending (NULL; no payment claims in UI)
- future payment feature remains v0.7 (out of scope)

## Known external limitation

GitHub Actions:
"Currently unavailable because GitHub account billing is locked."

- Git repository remains available
- code pushes remain available
- local verification remains available (`scripts/release-check.sh`)
- tag-CI has not successfully executed (trigger verified; jobs never start)

Do NOT claim tag-CI passed.

## Fresh-machine reconstruction

1. `git clone https://github.com/Xdashio/wellups-auto-tyres.git`
2. `git checkout main`
3. `node --version` → 26; `npm ci --no-audit --no-fund`
4. Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` +
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (request from Simon — NEVER committed;
   `.gitignore` covers `.env*`; `.dev.vars` is now untracked — see note)
5. `npm run lint && npm run typecheck && npm test && npm run build`
6. DB scratch gate needs local Postgres 18 + pgTAP (`scripts/ci-db.sh`;
   env `PGHOST/PGPORT/PGUSER/PGTAP_SQL`)
7. Live Supabase work needs the linked project (`wellups-auto-tyres`,
   ref `odammhhhryyepynnilbr`) — migrations via `supabase db push`
   (currently 001–016 in sync; push only new approved migrations)

NOTE on `.dev.vars`: Wrangler's local-secrets file was historically tracked
containing only an empty `NEXTJS_ENV=` (no secret material — verified).
It is now untracked and gitignored so future local secrets cannot be
committed accidentally.

## Next development work

Per `docs/RELEASE.md`, `docs/ROADMAP.md`, `docs/PRODUCTION_DATA_CONTRACT.md`:
first real catalog rows via Admin UI/loader, staff provisioning, warranty
publish, domain + M-Pesa config, catalog-dependent E2E re-run, tag-CI
observation once billing is restored (immutable `v0.4.0-rc.1`), then
deployment authorization. No invented roadmap items.
