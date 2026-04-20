// Package bridge provides thin adapters that connect infrastructure (Kafka, etc.)
// to the WebSocket hub. It exists to keep the ws package free of domain knowledge.
package bridge

import (
	"encoding/json"
	"log/slog"

	"github.com/Prypiatos/ems-app/backend/internal/ws"
)

// TopicMapping maps Kafka topic names to WebSocket topic names.
// Extend this map when new Kafka topics are added.
var TopicMapping = map[string]string{
	"energy.readings":  "readings",
	"energy.anomalies": "alerts",
	"energy.forecasts": "forecasts",
}

// ForwardToHub publishes a Kafka message to the appropriate WebSocket topic.
//
// Parameters:
//   - hub: the WebSocket hub to publish to
//   - kafkaTopic: the Kafka topic the message came from
//   - divisionID: extracted from the Kafka message key or payload; empty for global broadcast
//   - payload: the raw JSON payload to relay (not deserialized)
func ForwardToHub(hub *ws.Hub, kafkaTopic string, divisionID string, payload []byte) {
	wsTopic, ok := TopicMapping[kafkaTopic]
	if !ok {
		slog.Warn("unknown kafka topic, skipping ws forward", "kafka_topic", kafkaTopic)
		return
	}

	room := ""
	if divisionID != "" {
		room = "division:" + divisionID
	}

	hub.Publish(wsTopic, room, json.RawMessage(payload))
}
