#!/usr/bin/env bash
# Regression test for the release-check secret scan self-match (GATE 025).
# Proves, with synthetic fixtures only (never real credentials):
#   1. a tracked file containing a secret fingerprint FAILS the scan logic
#   2. the scanner source itself PASSES (it holds no fingerprint literally)
# Fingerprints are assembled at runtime here too, so this test file never
# contains one literally and cannot trip the scan itself.
# Usage: bash scripts/release-check-secret-scan.test.sh
set -uo pipefail

svc_role_pat="SUPABASE_SERVICE_ROLE""_KEY"
jwt_pat="SUPABASE_JWT""_SECRET"
key_pat="BEGIN PRIVATE"" KEY"

scan_repo() { # $1 = repo dir; prints matching lines or nothing
  git -C "$1" grep -c -e "$svc_role_pat" -e "$key_pat" -e "$jwt_pat" HEAD -- . 2>/dev/null | grep -v ":0" || true
}

fail=0

# 1. Positive control: scratch repo with synthetic secret-name fixtures.
work="$(mktemp -d /tmp/opencode-scan-test.XXXXXX)"
trap 'rm -rf "$work"' EXIT
git -C "$work" init -q
git -C "$work" config user.email "scan-test@test.local"
git -C "$work" config user.name "scan-test"
{
  echo "# synthetic fixture — not a real credential"
  echo "cfg_${svc_role_pat}=synthetic-fake-value-for-tests-only"
  echo "cfg_${jwt_pat}=synthetic-fake-value-for-tests-only"
  echo "rsa_${key_pat}=synthetic-fake-value-for-tests-only"
} > "$work/fixture.env"
git -C "$work" add fixture.env
git -C "$work" commit -qm "fixture"
if [ -n "$(scan_repo "$work")" ]; then
  echo "PASS: synthetic secret fixture is detected"
else
  echo "FAIL: synthetic secret fixture was NOT detected"; fail=1
fi

# 2. Negative control: the committed scanner must not match itself.
hits="$(git grep -c -e "$svc_role_pat" -e "$key_pat" -e "$jwt_pat" HEAD -- scripts/release-check.sh scripts/release-check-secret-scan.test.sh 2>/dev/null | grep -v ":0" || true)"
if [ -z "$hits" ]; then
  echo "PASS: scanner source does not self-match"
else
  echo "FAIL: scanner source self-matches:"; echo "$hits"; fail=1
fi

# 3. The live tracked tree (current HEAD) must be clean under the same logic.
tree_hits="$(git grep -c -e "$svc_role_pat" -e "$key_pat" -e "$jwt_pat" HEAD -- . 2>/dev/null | grep -v ":0" || true)"
if [ -z "$tree_hits" ]; then
  echo "PASS: tracked tree is clean"
else
  echo "FAIL: tracked tree has hits:"; echo "$tree_hits"; fail=1
fi

[ "$fail" -eq 0 ] && echo "SECRET-SCAN REGRESSION: PASS" || { echo "SECRET-SCAN REGRESSION: FAIL"; exit 1; }
