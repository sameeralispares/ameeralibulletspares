#!/usr/bin/env bash
# Stop local test stack services (leaves PostgreSQL and data in place).
STACK="${LOCAL_STACK_DIR:-/opt/localstack}"
for name in gateway postgrest auth; do
  pidfile="$STACK/run/$name.pid"
  if [[ -f "$pidfile" ]]; then
    kill "$(cat "$pidfile")" 2>/dev/null || true
    rm -f "$pidfile"
  fi
done
echo "local stack services stopped"
