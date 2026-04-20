package ws

import (
	"encoding/json"
	"log/slog"
	"sync"
)

// subscriptionKey identifies a unique (topic, room) pair.
type subscriptionKey struct {
	Topic string
	Room  string
}

// Hub manages client connections, subscriptions, and message fan-out.
// It is safe for concurrent use.
type Hub struct {
	mu          sync.RWMutex
	clients     map[*Client]struct{}
	subscribers map[subscriptionKey]map[*Client]struct{}
	logger      *slog.Logger
}

// NewHub creates a new Hub. Pass a structured logger; if nil, slog.Default() is used.
func NewHub(logger *slog.Logger) *Hub {
	if logger == nil {
		logger = slog.Default()
	}
	return &Hub{
		clients:     make(map[*Client]struct{}),
		subscribers: make(map[subscriptionKey]map[*Client]struct{}),
		logger:      logger,
	}
}

// Register adds a client to the hub. Called when a WebSocket connection is established.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = struct{}{}
	h.logger.Info("client registered",
		"client_id", c.ID,
		"remote_addr", c.RemoteAddr,
		"total_clients", len(h.clients),
	)
}

// Unregister removes a client and all its subscriptions.
// Called when the WebSocket connection is closed.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for key, subs := range h.subscribers {
		delete(subs, c)
		if len(subs) == 0 {
			delete(h.subscribers, key)
		}
	}

	delete(h.clients, c)
	close(c.Send)

	h.logger.Info("client unregistered",
		"client_id", c.ID,
		"total_clients", len(h.clients),
	)
}

// Subscribe adds a client to a (topic, room) channel.
func (h *Hub) Subscribe(c *Client, topic, room string) {
	key := subscriptionKey{Topic: topic, Room: room}

	h.mu.Lock()
	defer h.mu.Unlock()

	if h.subscribers[key] == nil {
		h.subscribers[key] = make(map[*Client]struct{})
	}
	h.subscribers[key][c] = struct{}{}

	h.logger.Info("client subscribed",
		"client_id", c.ID,
		"topic", topic,
		"room", room,
	)
}

// Unsubscribe removes a client from a (topic, room) channel.
func (h *Hub) Unsubscribe(c *Client, topic, room string) {
	key := subscriptionKey{Topic: topic, Room: room}

	h.mu.Lock()
	defer h.mu.Unlock()

	if subs, ok := h.subscribers[key]; ok {
		delete(subs, c)
		if len(subs) == 0 {
			delete(h.subscribers, key)
		}
	}

	h.logger.Info("client unsubscribed",
		"client_id", c.ID,
		"topic", topic,
		"room", room,
	)
}

// Publish sends a payload to all clients subscribed to (topic, room).
// The data argument must be pre-serialized JSON. This is the method
// external producers (e.g. a Kafka bridge) call.
func (h *Hub) Publish(topic, room string, data json.RawMessage) {
	msg := OutboundMessage{
		Topic: topic,
		Room:  room,
		Data:  data,
	}

	key := subscriptionKey{Topic: topic, Room: room}

	h.mu.RLock()
	defer h.mu.RUnlock()

	subs := h.subscribers[key]
	for client := range subs {
		payload, err := client.encodeOutbound(msg)
		if err != nil {
			h.logger.Error("failed to encode outbound message",
				"error", err,
				"client_id", client.ID,
			)
			continue
		}

		select {
		case client.Send <- payload:
		default:
			// Client send buffer is full — drop this message (non-blocking).
			h.logger.Warn("dropping message, client buffer full",
				"client_id", client.ID,
				"topic", topic,
				"room", room,
			)
		}
	}
}

// ClientCount returns the current number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// SubscriberCount returns the number of clients subscribed to a (topic, room).
func (h *Hub) SubscriberCount(topic, room string) int {
	key := subscriptionKey{Topic: topic, Room: room}
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.subscribers[key])
}
