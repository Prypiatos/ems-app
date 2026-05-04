#!/usr/bin/env bash
set -euo pipefail

NODE_TYPE="smart_meter"
NODE_IDS=("node_001" "node_002" "node_003")
SLEEP_SECONDS=1

for NODE_ID in "${NODE_IDS[@]}"; do
  for TOPIC in "energy.nodes.${NODE_ID}.telemetry" "energy.nodes.${NODE_ID}.events" "energy.nodes.${NODE_ID}.health"; do
    echo "Creating topic (if missing): $TOPIC"
    docker compose exec -T broker /opt/kafka/bin/kafka-topics.sh \
      --bootstrap-server localhost:9092 \
      --create \
      --if-not-exists \
      --topic "$TOPIC" \
      --partitions 1 \
      --replication-factor 1
  done
done

echo "Publishing telemetry/events/health for multiple nodes (Ctrl+C to stop)"
i=1
declare -A NODE_TICKS
declare -A NODE_SEQUENCE
for NODE_ID in "${NODE_IDS[@]}"; do
  NODE_TICKS["$NODE_ID"]=0
  NODE_SEQUENCE["$NODE_ID"]=1
done

for NODE_ID in "${NODE_IDS[@]}"; do
  now_ms=$(date +%s%3N)
  health_payload="{\"node_id\":\"$NODE_ID\",\"node_type\":\"$NODE_TYPE\",\"timestamp\":$now_ms,\"sequence_no\":1,\"status\":\"online\",\"uptime_sec\":0,\"mqtt_connected\":true,\"wifi_connected\":true,\"sensor_ok\":true,\"buffered_count\":0}"
  printf '%s\n' "$health_payload" | docker compose exec -T broker /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic "energy.nodes.${NODE_ID}.health" >/dev/null
  echo "[health:init:$NODE_ID] $health_payload"
  NODE_SEQUENCE["$NODE_ID"]=2

  event_payload="{\"node_id\":\"$NODE_ID\",\"node_type\":\"$NODE_TYPE\",\"timestamp\":$now_ms,\"event_type\":\"startup\",\"severity\":\"low\",\"message\":\"Device startup event\",\"buffered\":false}"
  printf '%s\n' "$event_payload" | docker compose exec -T broker /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic "energy.nodes.${NODE_ID}.events" >/dev/null
  echo "[event:init:$NODE_ID] $event_payload"
done

while true; do
  node_index=$(( (i - 1) % ${#NODE_IDS[@]} ))
  NODE_ID="${NODE_IDS[$node_index]}"
  TELEMETRY_TOPIC="energy.nodes.${NODE_ID}.telemetry"
  EVENTS_TOPIC="energy.nodes.${NODE_ID}.events"
  HEALTH_TOPIC="energy.nodes.${NODE_ID}.health"
  NODE_TICKS["$NODE_ID"]=$(( NODE_TICKS["$NODE_ID"] + 1 ))
  node_tick=${NODE_TICKS["$NODE_ID"]}

  now_ms=$(date +%s%3N)
  voltage=$(awk "BEGIN { printf \"%.1f\", 225 + (($i % 7) - 3) * 0.7 }")
  current=$(awk "BEGIN { printf \"%.2f\", 3.2 + (($i % 9) * 0.15) }")
  power=$(awk "BEGIN { printf \"%.1f\", $voltage * $current }")
  energy_wh=$(awk "BEGIN { printf \"%.3f\", $i * 4.125 }")

  telemetry_payload="{\"node_id\":\"$NODE_ID\",\"timestamp\":$now_ms,\"voltage\":$voltage,\"current\":$current,\"power\":$power,\"energy_wh\":$energy_wh}"
  printf '%s\n' "$telemetry_payload" | docker compose exec -T broker /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic "$TELEMETRY_TOPIC" >/dev/null
  echo "[telemetry:$NODE_ID:$i] $telemetry_payload"

  if (( node_tick % 20 == 0 )); then
    uptime_sec=$((i))
    sequence_no=${NODE_SEQUENCE["$NODE_ID"]}
    health_payload="{\"node_id\":\"$NODE_ID\",\"node_type\":\"$NODE_TYPE\",\"timestamp\":$now_ms,\"sequence_no\":$sequence_no,\"status\":\"online\",\"uptime_sec\":$uptime_sec,\"mqtt_connected\":true,\"wifi_connected\":true,\"sensor_ok\":true,\"buffered_count\":0}"
    printf '%s\n' "$health_payload" | docker compose exec -T broker /opt/kafka/bin/kafka-console-producer.sh \
      --bootstrap-server localhost:9092 \
      --topic "$HEALTH_TOPIC" >/dev/null
    echo "[health:$NODE_ID:$sequence_no] $health_payload"
    NODE_SEQUENCE["$NODE_ID"]=$(( sequence_no + 1 ))
  fi

  if (( node_tick % 8 == 0 )); then
    if (( node_tick % 24 == 0 )); then
      event_type="high_voltage"
      severity="high"
      message="Voltage exceeded 250V threshold"
    elif (( node_tick % 16 == 0 )); then
      event_type="disconnect"
      severity="medium"
      message="Temporary connectivity interruption"
    else
      event_type="warning"
      severity="low"
      message="Minor fluctuation detected"
    fi
    event_payload="{\"node_id\":\"$NODE_ID\",\"node_type\":\"$NODE_TYPE\",\"timestamp\":$now_ms,\"event_type\":\"$event_type\",\"severity\":\"$severity\",\"message\":\"$message\",\"buffered\":false}"
    printf '%s\n' "$event_payload" | docker compose exec -T broker /opt/kafka/bin/kafka-console-producer.sh \
      --bootstrap-server localhost:9092 \
      --topic "$EVENTS_TOPIC" >/dev/null
    echo "[event:$NODE_ID] $event_payload"
  fi

  i=$((i + 1))
  sleep "$SLEEP_SECONDS"
done
