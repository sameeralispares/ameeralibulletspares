#!/usr/bin/env bash
# Local Supabase-compatible TEST stack. Never used in production.
#
#   scripts/local-stack/start.sh          start (create DB on first run)
#   scripts/local-stack/start.sh --reset  drop and rebuild the local database
#   scripts/local-stack/stop.sh           stop services
#
# Requires: PostgreSQL 16 server, and the PostgREST + Supabase Auth binaries in
# $LOCAL_STACK_DIR (see docs/TEST_REPORT.md "Local test stack").
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
STACK="${LOCAL_STACK_DIR:-/opt/localstack}"
DB="${LOCAL_DB_NAME:-sameer_local}"
LOGS="$STACK/logs"
mkdir -p "$LOGS" "$STACK/run"

psql_su() { su postgres -c "psql -v ON_ERROR_STOP=1 -q -d $1" ; }

# 1. PostgreSQL
pg_ctlcluster 16 main start 2>/dev/null || true
for _ in $(seq 1 20); do su postgres -c "pg_isready -q" && break; sleep 0.5; done

if [[ "${1:-}" == "--reset" ]]; then
  "$HERE/stop.sh" >/dev/null 2>&1 || true
  su postgres -c "dropdb --if-exists $DB"
  rm -rf "$STACK/storage-data" "$STACK/mail"
fi

# 2. Secrets for this machine only
if [[ ! -f "$STACK/jwt-secret" ]]; then
  head -c 48 /dev/urandom | base64 | tr -d '\n=+/' > "$STACK/jwt-secret"
fi
JWT_SECRET="$(cat "$STACK/jwt-secret")"

FRESH=0
if ! su postgres -c "psql -lqt" | cut -d'|' -f1 | grep -qw "$DB"; then
  su postgres -c "createdb $DB"
  FRESH=1
fi

if [[ $FRESH == 1 ]]; then
  psql_su "$DB" < "$HERE/bootstrap.sql"
fi

# 3. Supabase Auth migrations (idempotent)
export GOTRUE_DB_DRIVER=postgres
export DATABASE_URL="postgres://supabase_auth_admin:local-auth-admin@127.0.0.1:5432/$DB"
export API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1"
export GOTRUE_API_HOST=127.0.0.1 PORT=9999
export GOTRUE_SITE_URL="${SITE_URL:-http://localhost:3000}"
export GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**,http://127.0.0.1:3000/**"
export GOTRUE_DISABLE_SIGNUP=true
export GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated
export GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true
export GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 GOTRUE_SMTP_ADMIN_EMAIL=noreply@local.test
export GOTRUE_SMTP_SENDER_NAME="Local Test"
export GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify
# Custom recovery email that links straight to /auth/confirm with token_hash,
# so recovery uses verifyOtp (no PKCE code-verifier cookie needed). Mirrors the
# production dashboard template documented in docs/DEPLOYMENT.md.
export GOTRUE_MAILER_TEMPLATES_RECOVERY="http://127.0.0.1:54321/local-templates/recovery.html"
export GOTRUE_MAILER_SUBJECTS_RECOVERY="Reset your password"
export GOTRUE_RATE_LIMIT_EMAIL_SENT=1000
# Local testing sends recovery emails back to back; the 1-minute default would
# throttle reruns. Local sink only — production keeps Supabase's own limits.
export GOTRUE_SMTP_MAX_FREQUENCY=1s
export GOTRUE_LOG_LEVEL=info
(cd "$STACK" && ./auth migrate >"$LOGS/auth-migrate.log" 2>&1)
psql_su "$DB" < "$HERE/post-auth.sql"

# 4. Project migrations (tracked)
psql_su "$DB" <<'SQL'
create table if not exists public._local_migrations (name text primary key, applied_at timestamptz default now());
revoke all on public._local_migrations from anon, authenticated;
alter table public._local_migrations enable row level security;
SQL
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  done_already=$(su postgres -c "psql -tA -d $DB -c \"select 1 from public._local_migrations where name='$name'\"")
  if [[ "$done_already" != "1" ]]; then
    echo "applying $name"
    psql_su "$DB" < "$f"
    su postgres -c "psql -q -d $DB -c \"insert into public._local_migrations(name) values ('$name')\""
  fi
done

# 5. Services
start_bg() { # name cmd...
  local name=$1; shift
  if [[ -f "$STACK/run/$name.pid" ]] && kill -0 "$(cat "$STACK/run/$name.pid")" 2>/dev/null; then return; fi
  nohup "$@" >"$LOGS/$name.log" 2>&1 &
  echo $! > "$STACK/run/$name.pid"
}

(cd "$STACK" && start_bg auth ./auth serve)

PGRST_DB_URI="postgres://authenticator:local-authenticator@127.0.0.1:5432/$DB" \
PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_DB_EXTRA_SEARCH_PATH=public,extensions \
PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=3001 PGRST_SERVER_HOST=127.0.0.1 \
  start_bg postgrest "$STACK/postgrest"

LOCAL_JWT_SECRET="$JWT_SECRET" LOCAL_STACK_DIR="$STACK" \
STORAGE_DB_URL="postgres://supabase_storage_admin:local-storage-admin@127.0.0.1:5432/$DB" \
  start_bg gateway node "$HERE/gateway.mjs"

# 6. Keys + env file (outside the repository)
node "$HERE/keys.mjs" "$JWT_SECRET" > "$STACK/local.env"

for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:54321/auth/v1/health >/dev/null 2>&1 \
     && curl -fsS http://127.0.0.1:3001/ >/dev/null 2>&1; then
    echo "local stack ready: http://127.0.0.1:54321  (env: $STACK/local.env)"
    exit 0
  fi
  sleep 0.5
done
echo "local stack failed to start; see $LOGS" >&2
exit 1
