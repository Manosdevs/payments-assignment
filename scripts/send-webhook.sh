#!/usr/bin/env bash
# Simulate the payment provider: send one webhook for an order.
#
#   scripts/send-webhook.sh <order_id> <processing|succeeded|failed> [event_id]
#
# The event ID is generated unless given; pass the same one twice to see the
# duplicate path. BASE_URL defaults to http://localhost:3000.
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "usage: $0 <order_id> <processing|succeeded|failed> [event_id]" >&2
  exit 1
fi

order_id=$1
status=$2
event_id=${3:-evt_$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')}
occurred_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
base_url=${BASE_URL:-http://localhost:3000}

body=$(printf '{"event_id":"%s","order_id":"%s","status":"%s","occurred_at":"%s"}' \
  "$event_id" "$order_id" "$status" "$occurred_at")

echo "POST $base_url/webhooks/payments $body"
curl -sS -w '\nHTTP %{http_code}\n' \
  -H 'Content-Type: application/json' \
  -d "$body" \
  "$base_url/webhooks/payments"
