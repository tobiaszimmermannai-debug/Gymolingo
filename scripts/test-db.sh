#!/usr/bin/env bash
# Runs the pgTAP suites in supabase/tests/database directly via psql
# (fallback for environments where the pg_prove container cannot be pulled).
set -uo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
fail=0
for f in supabase/tests/database/*.test.sql; do
  out=$(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -t -A -f "$f" 2>&1)
  code=$?
  total=$(echo "$out" | grep -cE '^(not )?ok ')
  bad=$(echo "$out" | grep -E '^not ok|ERROR|# Looks like' || true)
  if [[ $code -ne 0 || -n "$bad" ]]; then
    echo "FAIL $f"
    echo "$out" | grep -E '^not ok|#|ERROR' | head -30
    fail=1
  else
    echo "ok   $f ($total assertions)"
  fi
done
exit $fail
