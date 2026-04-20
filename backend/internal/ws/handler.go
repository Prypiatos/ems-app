package ws

import (
	"fmt"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// clientCounter generates unique client IDs without an external dependency.
var clientCounter atomic.Uint64

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// TODO: restrict CheckOrigin in production.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Handler returns an http.HandlerFunc that upgrades HTTP requests to WebSocket
// connections and registers them with the given Hub.
//
// Mount it on any path, e.g.:
//
//	mux.HandleFunc("GET /ws", ws.Handler(hub, logger))
func Handler(hub *Hub, logger *slog.Logger) http.HandlerFunc {
	if logger == nil {
		logger = slog.Default()
	}

	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Error("websocket upgrade failed", "error", err)
			return
		}

		clientID := fmt.Sprintf("client_%d", clientCounter.Add(1))
		client := NewClient(clientID, hub, conn, logger)
		hub.Register(client)

		// Each client needs exactly two goroutines.
		go client.WritePump()
		go client.ReadPump()
	}
}

// SocketIOHandler provides a minimal Socket.IO v4-compatible websocket endpoint.
// It supports Engine.IO websocket transport and join/leave division events.
func SocketIOHandler(hub *Hub, logger *slog.Logger) http.HandlerFunc {
	if logger == nil {
		logger = slog.Default()
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("transport") != "websocket" {
			http.Error(w, "transport must be websocket", http.StatusBadRequest)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Error("socket.io websocket upgrade failed", "error", err)
			return
		}

		sid := fmt.Sprintf("sio_%d", time.Now().UnixNano())
		open := fmt.Sprintf(`0{"sid":"%s","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}`, sid)
		if err := conn.WriteMessage(websocket.TextMessage, []byte(open)); err != nil {
			logger.Error("failed to write socket.io open packet", "error", err)
			conn.Close()
			return
		}

		clientID := fmt.Sprintf("client_%d", clientCounter.Add(1))
		client := NewSocketIOClient(clientID, sid, hub, conn, logger)
		hub.Register(client)

		go client.WritePump()
		go client.ReadPump()
	}
}
