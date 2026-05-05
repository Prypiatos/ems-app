package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/stream"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/gorilla/websocket"
)

func TestRouterHealthAndRootHandlers(t *testing.T) {
	router := NewRouterBuilder().
		WithWsHub(ws.NewHub([]string{"energy.readings"}, 1)).
		WithTelemetryTopic("energy.readings").
		WithState(stream.NewState()).
		WithClientBufferSize(1).
		WithClientWriteDeadline(time.Second).
		WithClientReadDeadline(time.Second).
		WithClientPingInterval(time.Second).
		Build()

	t.Run("root", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if body := rec.Body.String(); body != "Welcome!!!" {
			t.Fatalf("body = %q, want %q", body, "Welcome!!!")
		}
	})

	t.Run("health", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if contentType := rec.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
			t.Fatalf("Content-Type = %q, want application/json", contentType)
		}
		var payload map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode health body: %v", err)
		}
		if payload["status"] != "ok" {
			t.Fatalf("status = %v, want ok", payload["status"])
		}
	})
}

func TestRouterWebsocketReadingsRouteUpgrades(t *testing.T) {
	router := NewRouterBuilder().
		WithWsHub(ws.NewHub([]string{"energy.readings"}, 1)).
		WithTelemetryTopic("energy.readings").
		WithState(stream.NewState()).
		WithClientBufferSize(1).
		WithClientWriteDeadline(time.Second).
		WithClientReadDeadline(time.Second).
		WithClientPingInterval(0).
		Build()
	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/readings"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("websocket dial: %v", err)
	}
	defer conn.Close()
}
