# Release process — Well Lups Auto Tyres

Status: DESIGN. No production deployment is authorized. No release tags exist
beyond historical milestone markers (`v0.1-foundation`, `v0.2-public-catalog`,
local-only `v0.3`), none of which are release artifacts.

> CI AVAILABILITY NOTE (GATE 021): automated CI (GitHub Actions) is
> currently unable to execute jobs because of an EXTERNAL account
> billing lock — not a repository defect. Until it is restored, release
> verification uses the deterministic local equivalent
> (`scripts/release-check.sh`), which runs the same checks CI would run.
> Local verification does NOT constitute a claim that GitHub Actions
> tag-CI has passed. The requirement for eventual automated tag-CI
> certification stands.

## Branch model

| Branch | Role |
|---|---|
| `main` | Production line. Merge-only from `release/*`. No direct commits. Currently a docs/prototype shell — see "Main transition" below. |
| `v0.1-implementation` | Current integration line (will be superseded by short-lived `feat/*` branches once the release model is fully adopted). |
| `release/vX.Y` | Short-lived, frozen release candidates cut from the integration line. Stabilization fixes only; no new scope after cut. |
| `feat/<milestone>-<slug>` | Feature work, one milestone per branch, squash-merged via PR. |

## Release sequence

```
feature branch → PR (ci.yml) → merge to integration
  → cut release/vX.Y (ci.yml validates the branch)
  → freeze: tests + security + UX gates on the release branch
  → immutable tag vX.Y on the frozen green commit (ci.yml validates the tag)
  → explicit release approval (a later gate)
  → production deploy FROM THE TAG ONLY (release.yml, manual)
```

Rules: tags are never moved; production never deploys from a branch push;
`release.yml` fails closed until a gate authorizes deployment.

## CI coverage

- `ci.yml`: pushes to `main`, `v0.1-implementation`, `release/*`; all PRs;
  pushes of tags `v*` (validates the exact tagged commit; never deploys).
- `release.yml`: manual dispatch only; currently refuses every run.

## Release artifact (reproducibility)

From a clean checkout of a release tag, with only documented prerequisites
(Node 26, npm, the two `NEXT_PUBLIC_SUPABASE_*` values, Cloudflare account):

1. `npm ci --no-audit --no-fund` (locked by `package-lock.json`)
2. `npm run lint && npm run typecheck && npm test`
3. `npm run build` (`next build --webpack`) — 12 routes, no dev-only fallback
4. `npx opennextjs-cloudflare build` (`.open-next/` worker + assets)
5. Database: migrations 001–016 applied in order via `supabase db push`
   (verified by `supabase migration list` local == remote); demo data is
   NEVER part of the artifact — see `supabase/production/README.md`
6. `wrangler.jsonc` packages `.open-next/`; only public config in `vars`
   (Supabase URL); secrets enter via Cloudflare dashboard, never source

No hidden manual steps. No developer-local dependencies.

## Main transition (planned, NOT executed)

Current: `main` (9490bd7, prototype shell) vs implementation line (app + 016).
`git diff --stat origin/main..origin/v0.1-implementation` ≈ the entire
application (≈136 files) — there is nothing to "merge" file-by-file.

Proposed path (a later gate, after review + RC certification):

1. Certify the implementation line (tests + security + UX + real data plan).
2. Merge `v0.1-implementation` into `main` via PR (transparent merge commit;
   `main`'s prototype files either move under `prototype/` history or are
   removed in the merge — reviewable, no history rewrite).
3. Tag the merge commit as the first release candidate (`v0.4.0-rc.1` or as
   the gate directs); CI validates the tag.
4. From then on: `main` accepts merges from `release/*` only.

Risks: merge conflicts are near-certain to be trivial (disjoint file sets —
prototype assets vs application); the real risk is PROCESS (declaring `main`
production before data + workflow are ready), not technical. Required
verification after transition: full CI green on `main`, tag validation,
artifact rebuild from the tag, live auth-matrix spot check.
