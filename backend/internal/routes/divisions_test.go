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
	"github.com/Prypiatos/ems-app/backend/internal/stream"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func newTestRouter(divService *service.DivisionService) (*routes.Router, *ws.Hub) {
	topics := []string{"energy.readings"}
	hub := ws.NewHub(topics, 8)
	router := routes.NewRouterBuilder().
		WithWsHub(hub).
		WithTelemetryTopic("energy.readings").
		WithState(stream.NewState()).
		WithDivisionService(divService).
		WithClientBufferSize(8).
		WithClientWriteDeadline(0).
		WithClientReadDeadline(0).
		WithClientPingInterval(0).
		Build()
	return router, hub
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

func TestGetLiveReadings(t *testing.T) {
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
