package ws

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// writeWait is the time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// pongWait is the time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// pingPeriod is how often we send pings. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// maxMessageSize is the maximum inbound message size (64 KB).
	maxMessageSize = 64 * 1024

	// sendBufferSize is the capacity of the per-client outbound channel.
	sendBufferSize = 256
)

// Client represents a single WebSocket connection.
type Client struct {
	ID          string
	RemoteAddr  string
	hub         *Hub
	conn        *websocket.Conn
	Send        chan []byte
	logger      *slog.Logger
	protocol    string
	socketIOSID string
}

// NewClient creates a new Client bound to a hub and a WebSocket connection.
func NewClient(id string, hub *Hub, conn *websocket.Conn, logger *slog.Logger) *Client {
	return &Client{
		ID:         id,
		RemoteAddr: conn.RemoteAddr().String(),
		hub:        hub,
		conn:       conn,
		Send:       make(chan []byte, sendBufferSize),
		logger:     logger,
		protocol:   "raw",
	}
}

// NewSocketIOClient creates a client that speaks Engine.IO + Socket.IO frames.
func NewSocketIOClient(id string, sid string, hub *Hub, conn *websocket.Conn, logger *slog.Logger) *Client {
	c := NewClient(id, hub, conn, logger)
	c.protocol = "socketio"
	c.socketIOSID = sid
	return c
}

// ReadPump reads inbound messages from the WebSocket and dispatches them.
// It must be run in its own goroutine. When ReadPump returns, it unregisters
// the client from the hub and closes the connection.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure,
			) {
				c.logger.Error("unexpected websocket close",
					"client_id", c.ID,
					"error", err,
				)
			}
			return
		}

		if c.protocol == "socketio" {
			c.handleSocketIOMessage(message)
			continue
		}

		c.handleMessage(message)
	}
}

// WritePump pumps messages from the Send channel to the WebSocket connection.
// It also sends periodic pings. Must be run in its own goroutine.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel (client unregistered).
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleSocketIOMessage parses Engine.IO/Socket.IO frames and maps them to hub actions.
func (c *Client) handleSocketIOMessage(raw []byte) {
	frame := string(raw)

	switch {
	case frame == "2":
		// Engine.IO ping -> pong.
		c.sendRaw([]byte("3"))
		return

	case frame == "3":
		// Engine.IO pong from client (noop).
		return

	case strings.HasPrefix(frame, "40"):
		// Namespace connect ack for default namespace.
		c.sendRaw([]byte(fmt.Sprintf(`40{"sid":"%s"}`, c.socketIOSID)))
		return

	case strings.HasPrefix(frame, "42"):
		inbound, ctrlErr := parseSocketIOInbound(frame)
		if ctrlErr != nil {
			c.sendControl(*ctrlErr)
			return
		}

		switch inbound.Action {
		case "subscribe":
			c.hub.Subscribe(c, inbound.Topic, inbound.Room)
			c.sendControl(ControlMessage{
				Type:   "ack",
				Action: "subscribe",
				Topic:  inbound.Topic,
				Room:   inbound.Room,
			})
		case "unsubscribe":
			c.hub.Unsubscribe(c, inbound.Topic, inbound.Room)
			c.sendControl(ControlMessage{
				Type:   "ack",
				Action: "unsubscribe",
				Topic:  inbound.Topic,
				Room:   inbound.Room,
			})
		default:
			c.sendControl(ControlMessage{Type: "error", Message: "unknown action: " + inbound.Action})
		}
		return

	default:
		c.sendControl(ControlMessage{
			Type:    "error",
			Message: "unsupported socket.io frame",
		})
	}
}

type socketIODivisionPayload struct {
	Topic      string `json:"topic"`
	DivisionID string `json:"divisionId"`
}

func parseSocketIOInbound(frame string) (InboundMessage, *ControlMessage) {
	var packet []json.RawMessage
	if err := json.Unmarshal([]byte(frame[2:]), &packet); err != nil {
		return InboundMessage{}, &ControlMessage{Type: "error", Message: "invalid socket.io event packet"}
	}

	if len(packet) < 2 {
		return InboundMessage{}, &ControlMessage{Type: "error", Message: "socket.io event payload is required"}
	}

	var eventName string
	if err := json.Unmarshal(packet[0], &eventName); err != nil {
		return InboundMessage{}, &ControlMessage{Type: "error", Message: "invalid socket.io event name"}
	}

	switch eventName {
	case "subscribe", "unsubscribe":
		var payload InboundMessage
		if err := json.Unmarshal(packet[1], &payload); err != nil {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "invalid subscribe payload"}
		}
		if payload.Topic == "" {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "topic is required"}
		}
		payload.Action = eventName
		return payload, nil

	case "joinDivision":
		var payload socketIODivisionPayload
		if err := json.Unmarshal(packet[1], &payload); err != nil {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "invalid joinDivision payload"}
		}
		if payload.Topic == "" {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "topic is required"}
		}
		if payload.DivisionID == "" {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "divisionId is required"}
		}
		return InboundMessage{Action: "subscribe", Topic: payload.Topic, Room: "division:" + payload.DivisionID}, nil

	case "leaveDivision":
		var payload socketIODivisionPayload
		if err := json.Unmarshal(packet[1], &payload); err != nil {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "invalid leaveDivision payload"}
		}
		if payload.Topic == "" {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "topic is required"}
		}
		if payload.DivisionID == "" {
			return InboundMessage{}, &ControlMessage{Type: "error", Message: "divisionId is required"}
		}
		return InboundMessage{Action: "unsubscribe", Topic: payload.Topic, Room: "division:" + payload.DivisionID}, nil

	default:
		return InboundMessage{}, &ControlMessage{Type: "error", Message: "unknown socket.io event: " + eventName}
	}
}

func (c *Client) encodeOutbound(msg OutboundMessage) ([]byte, error) {
	if c.protocol == "socketio" {
		payload, err := json.Marshal(msg)
		if err != nil {
			return nil, err
		}
		return []byte(`42["event",` + string(payload) + `]`), nil
	}

	return json.Marshal(msg)
}

func (c *Client) encodeControl(ctrl ControlMessage) ([]byte, error) {
	if c.protocol == "socketio" {
		payload, err := json.Marshal(ctrl)
		if err != nil {
			return nil, err
		}
		eventName := ctrl.Type
		if eventName == "" {
			eventName = "message"
		}
		return []byte(`42["` + eventName + `",` + string(payload) + `]`), nil
	}

	return json.Marshal(ctrl)
}

func (c *Client) sendRaw(data []byte) {
	select {
	case c.Send <- data:
	default:
	}
}

// handleMessage parses an inbound JSON message and dispatches subscribe/unsubscribe.
func (c *Client) handleMessage(raw []byte) {
	var msg InboundMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.sendControl(ControlMessage{
			Type:    "error",
			Message: "invalid JSON",
		})
		return
	}

	if msg.Topic == "" {
		c.sendControl(ControlMessage{
			Type:    "error",
			Message: "topic is required",
		})
		return
	}

	switch msg.Action {
	case "subscribe":
		c.hub.Subscribe(c, msg.Topic, msg.Room)
		c.sendControl(ControlMessage{
			Type:   "ack",
			Action: "subscribe",
			Topic:  msg.Topic,
			Room:   msg.Room,
		})

	case "unsubscribe":
		c.hub.Unsubscribe(c, msg.Topic, msg.Room)
		c.sendControl(ControlMessage{
			Type:   "ack",
			Action: "unsubscribe",
			Topic:  msg.Topic,
			Room:   msg.Room,
		})

	default:
		c.sendControl(ControlMessage{
			Type:    "error",
			Message: "unknown action: " + msg.Action,
		})
	}
}

// sendControl marshals and enqueues a control message to the client.
func (c *Client) sendControl(ctrl ControlMessage) {
	data, err := c.encodeControl(ctrl)
	if err != nil {
		return
	}
	c.sendRaw(data)
}
