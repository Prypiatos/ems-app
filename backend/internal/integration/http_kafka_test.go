//go:build integration
// +build integration

package integration

import (
	"fmt"
	"testing"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/stream"
)

func TestKafkaUpdatesStateForEventsAndHealth(t *testing.T) {
	broker := kafkaBroker()
	nodeID := newNodeID()
	eventsTopic := fmt.Sprintf("energy.nodes.%s.events", nodeID)
	healthTopic := fmt.Sprintf("energy.nodes.%s.health", nodeID)

	createKafkaTopic(t, broker, eventsTopic)
	createKafkaTopic(t, broker, healthTopic)

	baseURL, stop := startRuntime(t)
	defer stop()

	now := time.Now().UnixMilli()
	event := stream.Event{
		NodeID:    nodeID,
		NodeType:  "smart_meter",
		Timestamp: now,
		EventType: "startup",
		Severity:  "low",
		Message:   "integration test event",
		Buffered:  false,
	}
	writeKafkaMessage(t, broker, eventsTopic, mustJSON(t, event))

	health := stream.Health{
		NodeID:        nodeID,
		NodeType:      "smart_meter",
		Timestamp:     now,
		SequenceNo:    1,
		Status:        "online",
		UptimeSec:     10,
		MQTTConnected: true,
		WiFiConnected: true,
		SensorOK:      true,
		BufferedCount: 0,
	}
	writeKafkaMessage(t, broker, healthTopic, mustJSON(t, health))

	waitForCondition(t, 10*time.Second, func() (bool, error) {
		var nodes []string
		if err := httpGetJSON(baseURL+"/api/v1/nodes", &nodes); err != nil {
			return false, err
		}
		return containsString(nodes, nodeID), nil
	})

	var events []stream.Event
	if err := httpGetJSON(baseURL+"/api/v1/nodes/"+nodeID+"/events?limit=1", &events); err != nil {
		t.Fatalf("get events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("events len = %d, want 1", len(events))
	}
	if events[0].NodeID != nodeID {
		t.Fatalf("event node_id = %q, want %q", events[0].NodeID, nodeID)
	}

	var gotHealth stream.Health
	if err := httpGetJSON(baseURL+"/api/v1/nodes/"+nodeID+"/health", &gotHealth); err != nil {
		t.Fatalf("get health: %v", err)
	}
	if gotHealth.NodeID != nodeID {
		t.Fatalf("health node_id = %q, want %q", gotHealth.NodeID, nodeID)
	}
	if gotHealth.Status != "online" {
		t.Fatalf("health status = %q, want online", gotHealth.Status)
	}
}

func TestKafkaDropsMismatchedEvent(t *testing.T) {
	broker := kafkaBroker()
	nodeID := newNodeID()
	eventsTopic := fmt.Sprintf("energy.nodes.%s.events", nodeID)

	createKafkaTopic(t, broker, eventsTopic)

	baseURL, stop := startRuntime(t)
	defer stop()

	badEvent := stream.Event{
		NodeID:    "other_node",
		NodeType:  "smart_meter",
		Timestamp: time.Now().UnixMilli(),
		EventType: "mismatch",
		Severity:  "high",
		Message:   "should be ignored",
		Buffered:  false,
	}
	writeKafkaMessage(t, broker, eventsTopic, mustJSON(t, badEvent))

	waitForCondition(t, 10*time.Second, func() (bool, error) {
		var nodes []string
		if err := httpGetJSON(baseURL+"/api/v1/nodes", &nodes); err != nil {
			return false, err
		}
		return containsString(nodes, nodeID), nil
	})

	var events []stream.Event
	if err := httpGetJSON(baseURL+"/api/v1/nodes/"+nodeID+"/events?limit=5", &events); err != nil {
		t.Fatalf("get events: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("events len = %d, want 0", len(events))
	}
}
