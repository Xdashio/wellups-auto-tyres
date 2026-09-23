#!/usr/bin/env bash
# Local release verification — deterministic equivalent of the checks GitHub
# Actions CI would run (see .github/workflows/ci.yml). Used while automated
# CI is unavailable for external reasons. NEVER claim this as "CI passed".
#
# Usage: ./scripts/release-check.sh [--skip-live] [--skip-db]
#   --skip-live  skip live Supabase suites (needs .env.local + network)
#   --skip-db    skip the scratch Postgres gate (needs psql + PGTAP_SQL)
# Env for the DB gate: PGHOST, PGPORT, PGUSER, PGTAP_SQL (same as ci-db.sh).
# Exit code: 0 only if every executed check passes. Skips are reported, never
# hidden, and do not fail the run — but a release decision must account them.
set -uo pipefail

SKIP_LIVE=0
SKIP_DB=0
for arg in "$@"; do
  case "$arg" in
    --skip-live) SKIP_LIVE=1 ;;
    --skip-db) SKIP_DB=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

pass=0
fail=0
skipped=()

report() { # $1 = pass|fail|skip, $2 = name
  case "$1" in
    pass) pass=$((pass + 1)); echo "PASS: $2" ;;
    fail) fail=$((fail + 1)); echo "FAIL: $2" ;;
    skip) skipped+=("$2"); echo "SKIP: $2" ;;
  esac
}

run_step() { # $1 = name, rest = command
  local name="$1"; shift
  echo "== $name"
  if "$@" > /tmp/opencode-release-check.log 2>&1; then
    report pass "$name"
  else
    tail -15 /tmp/opencode-release-check.log
    report fail "$name"
  fi
}

mkdir -p /tmp/opencode

run_step "eslint" npm run lint
run_step "typecheck" npm run typecheck
run_step "unit tests" npm run test

if [ "$SKIP_DB" = "1" ]; then
  report skip "db gate (ci-db.sh) — skipped by flag"
elif [ -z "${PGTAP_SQL:-}" ] || ! command -v psql > /dev/null 2>&1; then
  report skip "db gate (ci-db.sh) — needs psql + PGTAP_SQL env"
else
  run_step "db gate (ci-db.sh)" bash scripts/ci-db.sh
fi

run_step "production build" npm run build

echo "== secret scan (tracked tree only, names/locations — values never printed)"
# The three fingerprints are assembled at runtime so this file never
# contains any of them literally: a committed literal would make the scan
# match its own source (the GATE 025 false positive) and fail every run.
svc_role_pat="SUPABASE_SERVICE_ROLE""_KEY"
jwt_pat="SUPABASE_JWT""_SECRET"
key_pat="BEGIN PRIVATE"" KEY"
secret_hits="$(git grep -c -e "$svc_role_pat" -e "$key_pat" -e "$jwt_pat" HEAD -- . 2>/dev/null | grep -v ":0" || true)"
tracked_env="$(git ls-files | grep -iE '(^|/)\.env(\.|$)' | grep -v next-env.d.ts || true)"
if [ -z "$secret_hits" ] && [ -z "$tracked_env" ]; then
  report pass "secret scan"
else
  echo "$secret_hits"; echo "$tracked_env"
  report fail "secret scan"
fi

if [ "$SKIP_LIVE" = "1" ]; then
  report skip "live suites — skipped by flag"
else
  run_step "live: admin_write_paths" npx vitest run tests/admin_write_paths_live.test.ts
  run_step "live: quotes" npx vitest run tests/quotes_live.test.ts
fi
# bookings_live is catalog-dependent: with an intentionally empty production
# catalog it cannot execute (no service to book). Detect that state and skip
# with reason; the pre-retirement 20/20 evidence stands with the documented
# Path B wording. Never create fake rows to force it green.
if [ "$SKIP_LIVE" = "1" ]; then
  report skip "live: bookings (catalog-dependent)"
else
  echo "== live: bookings — checking catalog availability"
  svc_count="$(node --input-type=module -e "
import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs';
import fs from 'fs';
try {
  const env = Object.fromEntries(fs.readFileSync('.env.local','utf-8').split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^[\"']|[\"']\$/g,'')]}));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const r = await sb.from('services_public').select('id').limit(1);
  console.log(r.error ? 'ERR' : String(r.data?.length ?? 0));
} catch (e) { console.log('ERR'); }
" 2>/dev/null || echo ERR)"
  if [ "$svc_count" = "0" ]; then
    report skip "live: bookings — empty catalog (Path B evidence stands)"
  elif [ "$svc_count" = "ERR" ]; then
    report skip "live: bookings — catalog unreachable"
  elif npx vitest run tests/bookings_live.test.ts > /tmp/opencode-release-check.log 2>&1; then
    report pass "live: bookings"
  else
    tail -8 /tmp/opencode-release-check.log
    report fail "live: bookings"
  fi
fi

echo
echo "=============================="
echo "passed: $pass  failed: $fail  skipped: ${#skipped[@]}"
for s in ${skipped[@]+"${skipped[@]}"}; do echo "  skipped: $s"; done
echo "=============================="
[ "$fail" -eq 0 ]
