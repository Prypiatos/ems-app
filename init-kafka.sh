#!/bin/sh
set -e

TOPICS="energy.readings energy.anomalies energy.forecasts"

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
