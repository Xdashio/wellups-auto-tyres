#!/usr/bin/env bash
# Database gate: rebuilds an ephemeral Postgres database from the repo's
# migrations, runs every pgTAP suite, applies the seed, and asserts seed
# counts. Requires: psql, a running Postgres, pgTAP's pgtap.sql.
# Env: PGHOST, PGPORT, PGUSER, PGTAP_SQL (path), DB_NAME (default wellups_ci).
set -euo pipefail

DB_NAME="${DB_NAME:-wellups_ci}"
PGTAP_SQL="${PGTAP_SQL:?set PGTAP_SQL to the built sql/pgtap.sql path}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run() { psql -v ON_ERROR_STOP=1 -q "$@"; }

echo "== recreate database ${DB_NAME}"
psql -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB_NAME};" -c "create database ${DB_NAME};"

echo "== load pgTAP"
run -d "${DB_NAME}" -f "${PGTAP_SQL}"

echo "== apply local shim + migrations"
run -d "${DB_NAME}" -f "${REPO_ROOT}/supabase/tests/000_local_shim.sql"
for m in "${REPO_ROOT}"/supabase/migrations/*.sql; do
  echo "-- $m"
  run -d "${DB_NAME}" -f "$m"
done

echo "== pgTAP suites"
fail=0
for t in "${REPO_ROOT}"/supabase/tests/*.test.sql; do
  echo "-- $t"
  out="$(psql -d "${DB_NAME}" -f "$t" 2>&1)" || { echo "$out"; fail=1; continue; }
  echo "$out" | grep -aE '^ ?ok [0-9]+ -' > /dev/null
  if echo "$out" | grep -aq 'not ok'; then echo "$out" | grep -a 'not ok'; fail=1; fi
done

echo "== seed + seed assertions"
run -d "${DB_NAME}" -f "${REPO_ROOT}/supabase/seed.sql"
test "$(psql -d "${DB_NAME}" -tAc 'select count(*) from app.branches;')" = "1" || { echo "branch count != 1"; fail=1; }
test "$(psql -d "${DB_NAME}" -tAc "select count(*) from app.branches where address is null and phone is null and whatsapp is null and opening_hours is null;")" = "1" || { echo "branch contacts not all NULL"; fail=1; }
test "$(psql -d "${DB_NAME}" -tAc 'select count(*) from app.products;')" = "15" || { echo "product count != 15"; fail=1; }
test "$(psql -d "${DB_NAME}" -tAc 'select count(*) from app.services;')" = "8" || { echo "service count != 8"; fail=1; }

if [ "$fail" -ne 0 ]; then echo "DB GATE: FAIL"; exit 1; fi
echo "DB GATE: PASS"
