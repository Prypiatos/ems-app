#!/bin/sh
set -e

NODE_ID="${NODE_ID:-node_001}"
TOPICS="energy/nodes/${NODE_ID}/telemetry energy/nodes/${NODE_ID}/events energy/nodes/${NODE_ID}/health"

PARTITIONS=1
REPLICATION_FACTOR=1

echo "=== Creating topics ==="
for TOPIC in $TOPICS; do
  echo "Creating topic: $TOPIC"
  /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server broker:29092 \
    --create \
    --if-not-exists \
    --topic "$TOPIC" \
    --partitions $PARTITIONS \
    --replication-factor $REPLICATION_FACTOR
done

echo "=== Listing all topics ==="
/opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server broker:29092 \
  --list

echo "=== Kafka init completed successfully ==="
