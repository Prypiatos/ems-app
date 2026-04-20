package tests

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/Prypiatos/ems-app/backend/internal/ws"
)

// dial is a helper that upgrades to WebSocket against a test server.
func dial(t *testing.T, s *httptest.Server) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(s.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	return conn
}

func dialSocketIO(t *testing.T, s *httptest.Server) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(s.URL, "http") + "/socket.io/?EIO=4&transport=websocket"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("socket.io dial failed: %v", err)
	}
	return conn
}

func setupServer(t *testing.T) (*ws.Hub, *httptest.Server) {
	t.Helper()
	logger := slog.Default()
	hub := ws.NewHub(logger)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /ws", ws.Handler(hub, logger))
	mux.HandleFunc("GET /socket.io/", ws.SocketIOHandler(hub, logger))

	s := httptest.NewServer(mux)
	t.Cleanup(s.Close)
	return hub, s
}

func readSocketIOFrame(t *testing.T, conn *websocket.Conn) string {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("socket.io frame read failed: %v", err)
	}
	return string(data)
}

func readSocketIOEvent[T any](t *testing.T, conn *websocket.Conn, expectedEvent string) T {
	t.Helper()
	frame := readSocketIOFrame(t, conn)
	if !strings.HasPrefix(frame, "42") {
		t.Fatalf("expected socket.io event frame 42, got: %s", frame)
	}

	var packet []json.RawMessage
	if err := json.Unmarshal([]byte(frame[2:]), &packet); err != nil {
		t.Fatalf("failed to parse socket.io packet: %v", err)
	}
	if len(packet) < 2 {
		t.Fatalf("invalid socket.io packet: %s", frame)
	}

	var eventName string
	if err := json.Unmarshal(packet[0], &eventName); err != nil {
		t.Fatalf("failed to parse socket.io event name: %v", err)
	}
	if eventName != expectedEvent {
		t.Fatalf("expected socket.io event %q, got %q", expectedEvent, eventName)
	}

	var payload T
	if err := json.Unmarshal(packet[1], &payload); err != nil {
		t.Fatalf("failed to decode socket.io payload: %v", err)
	}
	return payload
}

func readJSON[T any](t *testing.T, conn *websocket.Conn) T {
	t.Helper()
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	var v T
	if err := json.Unmarshal(data, &v); err != nil {
		t.Fatalf("unmarshal failed: %v\nraw: %s", err, data)
	}
	return v
}

// ---------- Tests ----------

func TestHandshakeSucceeds(t *testing.T) {
	hub, s := setupServer(t)
	conn := dial(t, s)
	defer conn.Close()

	// Give the hub a moment to process the registration.
	time.Sleep(50 * time.Millisecond)

	if got := hub.ClientCount(); got != 1 {
		t.Errorf("expected 1 client, got %d", got)
	}
}

func TestSocketIOHandshakeSucceeds(t *testing.T) {
	hub, s := setupServer(t)
	conn := dialSocketIO(t, s)
	defer conn.Close()

	open := readSocketIOFrame(t, conn)
	if !strings.HasPrefix(open, "0{") {
		t.Fatalf("expected Engine.IO open packet, got: %s", open)
	}

	if err := conn.WriteMessage(websocket.TextMessage, []byte("40")); err != nil {
		t.Fatalf("failed to send socket.io connect packet: %v", err)
	}

	connectAck := readSocketIOFrame(t, conn)
	if !strings.HasPrefix(connectAck, "40") {
		t.Fatalf("expected Socket.IO connect ack packet, got: %s", connectAck)
	}

	time.Sleep(50 * time.Millisecond)
	if got := hub.ClientCount(); got != 1 {
		t.Errorf("expected 1 socket.io client, got %d", got)
	}
}

func TestSocketIOJoinLeaveDivisionRoom(t *testing.T) {
	hub, s := setupServer(t)
	conn := dialSocketIO(t, s)
	defer conn.Close()

	_ = readSocketIOFrame(t, conn) // open packet
	if err := conn.WriteMessage(websocket.TextMessage, []byte("40")); err != nil {
		t.Fatalf("failed to connect socket.io namespace: %v", err)
	}
	_ = readSocketIOFrame(t, conn) // connect ack

	join := `42["joinDivision",{"topic":"readings","divisionId":"7"}]`
	if err := conn.WriteMessage(websocket.TextMessage, []byte(join)); err != nil {
		t.Fatalf("failed to write joinDivision packet: %v", err)
	}

	ack := readSocketIOEvent[ws.ControlMessage](t, conn, "ack")
	if ack.Action != "subscribe" || ack.Topic != "readings" || ack.Room != "division:7" {
		t.Fatalf("unexpected join ack: %+v", ack)
	}

	hub.Publish("readings", "division:7", json.RawMessage(`{"kwh":12.5}`))
	out := readSocketIOEvent[ws.OutboundMessage](t, conn, "event")
	if out.Topic != "readings" || out.Room != "division:7" {
		t.Fatalf("unexpected socket.io outbound event: %+v", out)
	}

	leave := `42["leaveDivision",{"topic":"readings","divisionId":"7"}]`
	if err := conn.WriteMessage(websocket.TextMessage, []byte(leave)); err != nil {
		t.Fatalf("failed to write leaveDivision packet: %v", err)
	}

	unsubAck := readSocketIOEvent[ws.ControlMessage](t, conn, "ack")
	if unsubAck.Action != "unsubscribe" || unsubAck.Topic != "readings" || unsubAck.Room != "division:7" {
		t.Fatalf("unexpected leave ack: %+v", unsubAck)
	}

	hub.Publish("readings", "division:7", json.RawMessage(`{"kwh":13.1}`))

	conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Fatal("expected no event after leaveDivision")
	}
}

func TestSubscribeAndReceiveMessage(t *testing.T) {
	hub, s := setupServer(t)
	conn := dial(t, s)
	defer conn.Close()

	// Subscribe to a topic + room.
	sub := ws.InboundMessage{
		Action: "subscribe",
		Topic:  "readings",
		Room:   "division:5",
	}
	if err := conn.WriteJSON(sub); err != nil {
		t.Fatalf("write subscribe failed: %v", err)
	}

	// Read the ack.
	ack := readJSON[ws.ControlMessage](t, conn)
	if ack.Type != "ack" || ack.Action != "subscribe" || ack.Topic != "readings" || ack.Room != "division:5" {
		t.Errorf("unexpected ack: %+v", ack)
	}

	// Wait for subscription to be processed.
	time.Sleep(50 * time.Millisecond)

	// Publish a message from the server side.
	payload := json.RawMessage(`{"voltage":230.5,"current":12.3}`)
	hub.Publish("readings", "division:5", payload)

	// Read the outbound message.
	out := readJSON[ws.OutboundMessage](t, conn)
	if out.Topic != "readings" || out.Room != "division:5" {
		t.Errorf("unexpected outbound message: %+v", out)
	}

	var data map[string]float64
	if err := json.Unmarshal(out.Data, &data); err != nil {
		t.Fatalf("unmarshal data failed: %v", err)
	}
	if data["voltage"] != 230.5 {
		t.Errorf("expected voltage=230.5, got %v", data["voltage"])
	}
}

func TestUnsubscribeStopsMessages(t *testing.T) {
	hub, s := setupServer(t)
	conn := dial(t, s)
	defer conn.Close()

	// Subscribe.
	if err := conn.WriteJSON(ws.InboundMessage{Action: "subscribe", Topic: "alerts", Room: "division:1"}); err != nil {
		t.Fatal(err)
	}
	_ = readJSON[ws.ControlMessage](t, conn) // consume ack

	// Unsubscribe.
	if err := conn.WriteJSON(ws.InboundMessage{Action: "unsubscribe", Topic: "alerts", Room: "division:1"}); err != nil {
		t.Fatal(err)
	}
	unsubAck := readJSON[ws.ControlMessage](t, conn)
	if unsubAck.Type != "ack" || unsubAck.Action != "unsubscribe" {
		t.Errorf("unexpected unsub ack: %+v", unsubAck)
	}

	time.Sleep(50 * time.Millisecond)

	// Publish — client should NOT receive this.
	hub.Publish("alerts", "division:1", json.RawMessage(`{"severity":"high"}`))

	// Try to read with a short deadline — should timeout.
	conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Error("expected no message after unsubscribe, but got one")
	}
}

func TestMultipleClientsReceiveSameMessage(t *testing.T) {
	hub, s := setupServer(t)

	conn1 := dial(t, s)
	defer conn1.Close()
	conn2 := dial(t, s)
	defer conn2.Close()

	// Both subscribe to the same topic+room.
	sub := ws.InboundMessage{Action: "subscribe", Topic: "forecasts", Room: "division:3"}
	conn1.WriteJSON(sub)
	conn2.WriteJSON(sub)

	_ = readJSON[ws.ControlMessage](t, conn1) // ack
	_ = readJSON[ws.ControlMessage](t, conn2) // ack

	time.Sleep(50 * time.Millisecond)

	hub.Publish("forecasts", "division:3", json.RawMessage(`{"predicted_kwh":42}`))

	out1 := readJSON[ws.OutboundMessage](t, conn1)
	out2 := readJSON[ws.OutboundMessage](t, conn2)

	if out1.Topic != "forecasts" || out2.Topic != "forecasts" {
		t.Errorf("both clients should receive the forecast message")
	}
}

func TestDifferentRoomsAreIsolated(t *testing.T) {
	hub, s := setupServer(t)

	conn1 := dial(t, s)
	defer conn1.Close()
	conn2 := dial(t, s)
	defer conn2.Close()

	// conn1 subscribes to division:1, conn2 to division:2.
	conn1.WriteJSON(ws.InboundMessage{Action: "subscribe", Topic: "readings", Room: "division:1"})
	conn2.WriteJSON(ws.InboundMessage{Action: "subscribe", Topic: "readings", Room: "division:2"})

	_ = readJSON[ws.ControlMessage](t, conn1) // ack
	_ = readJSON[ws.ControlMessage](t, conn2) // ack

	time.Sleep(50 * time.Millisecond)

	// Publish to division:1 only.
	hub.Publish("readings", "division:1", json.RawMessage(`{"node":"A"}`))

	// conn1 should get it.
	out := readJSON[ws.OutboundMessage](t, conn1)
	if out.Room != "division:1" {
		t.Errorf("expected room division:1, got %s", out.Room)
	}

	// conn2 should NOT get it.
	conn2.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err := conn2.ReadMessage()
	if err == nil {
		t.Error("conn2 should not receive message for division:1")
	}
}

func TestInvalidJSONReturnsError(t *testing.T) {
	_, s := setupServer(t)
	conn := dial(t, s)
	defer conn.Close()

	// Send garbage.
	conn.WriteMessage(websocket.TextMessage, []byte("{invalid json"))

	ctrl := readJSON[ws.ControlMessage](t, conn)
	if ctrl.Type != "error" || ctrl.Message != "invalid JSON" {
		t.Errorf("expected error for invalid JSON, got: %+v", ctrl)
	}
}

func TestMissingTopicReturnsError(t *testing.T) {
	_, s := setupServer(t)
	conn := dial(t, s)
	defer conn.Close()

	conn.WriteJSON(ws.InboundMessage{Action: "subscribe", Topic: ""})

	ctrl := readJSON[ws.ControlMessage](t, conn)
	if ctrl.Type != "error" || ctrl.Message != "topic is required" {
		t.Errorf("expected 'topic is required' error, got: %+v", ctrl)
	}
}

func TestUnknownActionReturnsError(t *testing.T) {
	_, s := setupServer(t)
	conn := dial(t, s)
	defer conn.Close()

	conn.WriteJSON(ws.InboundMessage{Action: "noop", Topic: "readings"})

	ctrl := readJSON[ws.ControlMessage](t, conn)
	if ctrl.Type != "error" || ctrl.Message != "unknown action: noop" {
		t.Errorf("expected unknown action error, got: %+v", ctrl)
	}
}

func TestDisconnectCleansUpSubscriptions(t *testing.T) {
	hub, s := setupServer(t)
	conn := dial(t, s)

	conn.WriteJSON(ws.InboundMessage{Action: "subscribe", Topic: "readings", Room: "division:9"})
	_ = readJSON[ws.ControlMessage](t, conn) // ack

	time.Sleep(50 * time.Millisecond)

	if got := hub.SubscriberCount("readings", "division:9"); got != 1 {
		t.Fatalf("expected 1 subscriber, got %d", got)
	}

	// Close the connection.
	conn.Close()
	time.Sleep(100 * time.Millisecond)

	if got := hub.SubscriberCount("readings", "division:9"); got != 0 {
		t.Errorf("expected 0 subscribers after disconnect, got %d", got)
	}
	if got := hub.ClientCount(); got != 0 {
		t.Errorf("expected 0 clients after disconnect, got %d", got)
	}
}
