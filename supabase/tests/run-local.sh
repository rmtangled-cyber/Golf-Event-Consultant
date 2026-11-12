#!/usr/bin/env bash
# 使い方: PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/tests/run-local.sh
# 使い捨てデータベースを作り、Supabase スタブ → migration → テストの順に流す
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=golf_rpc_test
dropdb --if-exists "$DB"
createdb "$DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rpc_test.sql
