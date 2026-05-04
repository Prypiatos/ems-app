package routes_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/influx"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/service"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func newTestRouter(divService *service.DivisionService) (*routes.Router, *ws.Hub) {
	topics := []string{"energy.readings"}
	hub := ws.NewHub(topics, 8)
	router := routes.NewRouter(hub, divService, 8, 0, 0, 0)
	return router, hub
}

func TestHome(t *testing.T) {
	router, _ := newTestRouter(nil)

	tests := []struct {
		name   string
		path   string
		status int
		body   string
	}{
		{"returns correct response", "/", http.StatusOK, "Welcome!!!"},
		{"return 404 for unknown path", "/unknown", http.StatusNotFound, "404 page not found\n"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, test.path, nil)
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			if resp.Code != test.status {
				t.Fatalf("unexpected status: got %d want %d", resp.Code, test.status)
			}
			if resp.Body.String() != test.body {
				t.Fatalf("unexpected body: got %q want %q", resp.Body.String(), test.body)
			}
		})
	}
}

func TestGetHealth(t *testing.T) {
	router, _ := newTestRouter(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("unexpected status: got %d want %d", resp.Code, http.StatusOK)
	}
	if ct := resp.Result().Header.Get("Content-Type"); ct != types.JSONContentType {
		t.Fatalf("unexpected content type: got %q want %q", ct, types.JSONContentType)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("unexpected status payload: %v", body)
	}
}

func TestGetDivisionsEndpointMissingService(t *testing.T) {
	router, _ := newTestRouter(nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/divisions", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 when division service is nil, got %d", resp.Code)
	}
}

func TestGetDivisionSummaryBadID(t *testing.T) {
	mockInflux := influx.NewMockClient()
	divService := service.NewDivisionService(nil, mockInflux)
	router, _ := newTestRouter(divService)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/divisions/not-a-uuid/summary", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for bad UUID, got %d", resp.Code)
	}
}

func TestGetDivisionSummaryValidID(t *testing.T) {
	mockInflux := influx.NewMockClient()
	divService := service.NewDivisionService(nil, mockInflux)
	router, _ := newTestRouter(divService)

	validID := uuid.New().String()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/divisions/"+validID+"/summary", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code == http.StatusBadRequest {
		t.Fatalf("valid UUID rejected as bad request")
	}
}

func TestGetLiveReadings(t *testing.T) {
	t.Run("upgrades and unregisters client on disconnect", func(t *testing.T) {
		router, hub := newTestRouter(nil)
		server := httptest.NewServer(router)
		defer server.Close()

		ctx, cancel := context.WithCancel(context.Background())
		go hub.Broadcast(ctx, "energy.readings")
		defer cancel()

		wsURL := "ws" + server.URL[len("http"):] + "/api/v1/readings"
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("websocket dial failed: %v", err)
		}

		waitForClientCount(t, hub, 1, time.Second, "energy.readings")

		if err := conn.Close(); err != nil {
			t.Fatalf("failed to close websocket connection: %v", err)
		}

		waitForClientCount(t, hub, 0, time.Second, "energy.readings")
	})

	t.Run("connected client receives broadcasts", func(t *testing.T) {
		router, hub := newTestRouter(nil)
		server := httptest.NewServer(router)
		defer server.Close()

		ctx, cancel := context.WithCancel(context.Background())
		go hub.Broadcast(ctx, "energy.readings")
		defer cancel()

		wsURL := "ws" + server.URL[len("http"):] + "/api/v1/readings"
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("websocket dial failed: %v", err)
		}
		defer conn.Close()

		waitForClientCount(t, hub, 1, time.Second, "energy.readings")

		want := []byte(`{"node_id":"node_1","power_w":120.5}`)
		if ok := hub.Publish(ctx, "energy.readings", want, time.Second); !ok {
			t.Fatalf("publish failed")
		}

		if err := conn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
			t.Fatalf("failed setting read deadline: %v", err)
		}

		_, got, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("failed reading broadcast message: %v", err)
		}

		if string(got) != string(want) {
			t.Fatalf("unexpected broadcast payload: got %s want %s", got, want)
		}
	})
}

func waitForClientCount(t *testing.T, hub *ws.Hub, want int, timeout time.Duration, topic string) {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		lock, ok := hub.TopicLocks[topic]
		if !ok {
			t.Fatalf("missing topic lock for %q", topic)
		}

		lock.RLock()
		got := len(hub.WSClients[topic])
		lock.RUnlock()

		if got == want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}

	lock, ok := hub.TopicLocks[topic]
	if !ok {
		t.Fatalf("missing topic lock for %q", topic)
	}
	lock.RLock()
	got := len(hub.WSClients[topic])
	lock.RUnlock()
	if got != want {
		t.Fatalf("timed out waiting for client count: got %d want %d", got, want)
	}
}
