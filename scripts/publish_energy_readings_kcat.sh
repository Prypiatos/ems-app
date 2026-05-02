#!/usr/bin/env bash
set -euo pipefail

BROKER="${BROKER:-localhost:9092}"
TOPIC="${TOPIC:-energy.readings}"
COUNT="${COUNT:-10}"
DIVISION_ID="${DIVISION_ID:-division-a}"
INTERVAL_MS="${INTERVAL_MS:-0}"
MODE="${MODE:-batch}" # batch | stream
NODE_ID_PREFIX="${NODE_ID_PREFIX:-node-}"
NODE_COUNT="${NODE_COUNT:-5}"
BASE_VALUE="${BASE_VALUE:-220}"
NOISE_RANGE="${NOISE_RANGE:-25}"

if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [ "$COUNT" -lt 1 ]; then
  echo "COUNT must be a positive integer"
  exit 1
fi

if ! [[ "$INTERVAL_MS" =~ ^[0-9]+$ ]]; then
  echo "INTERVAL_MS must be a non-negative integer"
  exit 1
fi

if ! [[ "$NODE_COUNT" =~ ^[0-9]+$ ]] || [ "$NODE_COUNT" -lt 1 ]; then
  echo "NODE_COUNT must be a positive integer"
  exit 1
fi

if ! [[ "$BASE_VALUE" =~ ^[0-9]+$ ]] || [ "$BASE_VALUE" -lt 1 ]; then
  echo "BASE_VALUE must be a positive integer"
  exit 1
fi

if ! [[ "$NOISE_RANGE" =~ ^[0-9]+$ ]]; then
  echo "NOISE_RANGE must be a non-negative integer"
  exit 1
fi

sleep_interval_sec="$(awk "BEGIN { print $INTERVAL_MS / 1000 }")"

emit_message() {
  i="$1"
  node_idx="$2"
  now_ms=$(date +%s%3N)

  # Realistic changing pattern:
  # - slow sinusoidal baseline drift by message index
  # - random noise around baseline
  wave=$(awk "BEGIN { print sin($i/8) * 18 }")
  noise=0
  if [ "$NOISE_RANGE" -gt 0 ]; then
    noise=$(( (RANDOM % (NOISE_RANGE * 2 + 1)) - NOISE_RANGE ))
  fi

  value=$(awk "BEGIN { v = $BASE_VALUE + $wave + $noise; if (v < 1) v = 1; printf \"%.2f\", v }")
  iso_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  cat <<JSON
auto_key_$i|{"node_id":"${NODE_ID_PREFIX}${node_idx}","division_id":"$DIVISION_ID","divisionId":"$DIVISION_ID","kwh":$value,"value":$value,"ts_ms":$now_ms,"timestamp":"$iso_ts"}
JSON
}

if [ "$MODE" = "stream" ]; then
  i=1
  while true; do
    node_idx=$(( (i - 1) % NODE_COUNT + 1 ))
    emit_message "$i" "$node_idx"
    i=$((i + 1))
    if [ "$INTERVAL_MS" -gt 0 ]; then
      sleep "$sleep_interval_sec"
    fi
  done | docker run --rm -i --network host edenhill/kcat:1.7.1 -b "$BROKER" -t "$TOPIC" -K '|' -P
else
  for i in $(seq 1 "$COUNT"); do
    node_idx=$(( (i - 1) % NODE_COUNT + 1 ))
    emit_message "$i" "$node_idx"
    if [ "$INTERVAL_MS" -gt 0 ] && [ "$i" -lt "$COUNT" ]; then
      sleep "$sleep_interval_sec"
    fi
  done | docker run --rm -i --network host edenhill/kcat:1.7.1 -b "$BROKER" -t "$TOPIC" -K '|' -P
fi

if [ "$MODE" = "stream" ]; then
  echo "Streaming to $TOPIC on $BROKER (press Ctrl+C to stop)"
elif [ "$INTERVAL_MS" -gt 0 ]; then
  echo "Published $COUNT messages to $TOPIC on $BROKER with ${INTERVAL_MS}ms interval"
else
  echo "Published $COUNT messages to $TOPIC on $BROKER"
fi
