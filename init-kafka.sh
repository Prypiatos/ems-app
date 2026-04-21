#!/bin/sh
set -e

echo "=== Waiting for Kafka to be ready ==="
sleep 10

TOPICS="energy.readings energy.anomalies energy.forecasts"

PARTITIONS=1
REPLICATION_FACTOR=1

echo "=== Deleting previous topic ==="
for TOPIC in $TOPICS; do
  echo "Deleting topic: $TOPIC"
  /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server broker:29092 \
    --delete \
    --if-exists \
    --topic "$TOPIC"
done

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