//go:build integration
// +build integration

package integration

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestKafkaTelemetryToWebsocket(t *testing.T) {
	broker := kafkaBroker()
	nodeID := newNodeID()
	telemetryTopic := fmt.Sprintf("energy.nodes.%s.telemetry", nodeID)

	createKafkaTopic(t, broker, telemetryTopic)

	baseURL, stop := startRuntime(t)
	defer stop()

	wsURL := "ws" + strings.TrimPrefix(baseURL, "http") + "/api/v1/readings"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("websocket dial: %v", err)
	}
	defer conn.Close()

	payload := []byte(fmt.Sprintf("{\"node_id\":\"%s\",\"power_w\":120.5}", nodeID))
	writeKafkaMessage(t, broker, telemetryTopic, payload)

	if err := conn.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read websocket message: %v", err)
	}
	if string(msg) != string(payload) {
		t.Fatalf("payload mismatch: got %s want %s", msg, payload)
	}
}
