// Package ws provides a self-contained, topic-agnostic WebSocket pub/sub hub.
// It has zero knowledge of domain models, Kafka, or API contracts.
// Producers push pre-serialized []byte payloads; the hub relays them untouched.
package ws

import "encoding/json"

// InboundMessage is what clients send to the server.
type InboundMessage struct {
	Action string `json:"action"`        // "subscribe" | "unsubscribe"
	Topic  string `json:"topic"`         // logical event stream name
	Room   string `json:"room,omitempty"` // scoping key, e.g. "division:5"; empty = global
}

// OutboundMessage is what the server pushes to clients.
type OutboundMessage struct {
	Topic string          `json:"topic"`
	Room  string          `json:"room,omitempty"`
	Data  json.RawMessage `json:"data"` // opaque payload — never deserialized by this package
}

// ControlMessage is a server→client acknowledgement or error.
type ControlMessage struct {
	Type    string `json:"type"`              // "ack" | "error"
	Action  string `json:"action,omitempty"`  // echoed from the inbound action
	Topic   string `json:"topic,omitempty"`
	Room    string `json:"room,omitempty"`
	Message string `json:"message,omitempty"` // human-readable detail
}
