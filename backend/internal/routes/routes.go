package routes

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/service"
	"github.com/Prypiatos/ems-app/backend/internal/stream"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/google/uuid"
)

type Router struct {
	wsHub               *ws.Hub
	telemetryTopic      string
	state               *stream.State
	divisionService     *service.DivisionService
	clientBufferSize    int
	clientWriteDeadline time.Duration
	clientReadDeadline  time.Duration
	clientPingInterval  time.Duration
	http.Handler
}

type RouterBuilder struct {
	wsHub               *ws.Hub
	telemetryTopic      string
	state               *stream.State
	divisionService     *service.DivisionService
	clientBufferSize    int
	clientWriteDeadline time.Duration
	clientReadDeadline  time.Duration
	clientPingInterval  time.Duration
}

func NewRouterBuilder() *RouterBuilder {
	return &RouterBuilder{}
}

func (rb *RouterBuilder) WithWsHub(wsHub *ws.Hub) *RouterBuilder {
	rb.wsHub = wsHub
	return rb
}

func (rb *RouterBuilder) WithTelemetryTopic(telemetryTopic string) *RouterBuilder {
	rb.telemetryTopic = telemetryTopic
	return rb
}

func (rb *RouterBuilder) WithState(state *stream.State) *RouterBuilder {
	rb.state = state
	return rb
}

func (rb *RouterBuilder) WithDivisionService(divisionService *service.DivisionService) *RouterBuilder {
	rb.divisionService = divisionService
	return rb
}

func (rb *RouterBuilder) WithClientBufferSize(clientBufferSize int) *RouterBuilder {
	rb.clientBufferSize = clientBufferSize
	return rb
}

func (rb *RouterBuilder) WithClientWriteDeadline(clientWriteDeadline time.Duration) *RouterBuilder {
	rb.clientWriteDeadline = clientWriteDeadline
	return rb
}

func (rb *RouterBuilder) WithClientReadDeadline(clientReadDeadline time.Duration) *RouterBuilder {
	rb.clientReadDeadline = clientReadDeadline
	return rb
}

func (rb *RouterBuilder) WithClientPingInterval(clientPingInterval time.Duration) *RouterBuilder {
	rb.clientPingInterval = clientPingInterval
	return rb
}

func (rb *RouterBuilder) Build() *Router {
	rt := &Router{
		wsHub:               rb.wsHub,
		telemetryTopic:      rb.telemetryTopic,
		state:               rb.state,
		divisionService:     rb.divisionService,
		clientBufferSize:    rb.clientBufferSize,
		clientWriteDeadline: rb.clientWriteDeadline,
		clientReadDeadline:  rb.clientReadDeadline,
		clientPingInterval:  rb.clientPingInterval,
	}
	setupRoutes(rt)
	return rt
}

func setupRoutes(rt *Router) {
	router := http.NewServeMux()

	router.HandleFunc("GET /", rt.defaultHandler)
	router.HandleFunc("GET /api/v1/health", rt.getHealth)
	router.HandleFunc("GET /api/v1/readings", rt.getLiveReadings)
	router.HandleFunc("GET /api/v1/nodes", rt.getNodes)
	router.HandleFunc("GET /api/v1/nodes/{id}/events", rt.getNodeEvents)
	router.HandleFunc("GET /api/v1/nodes/{id}/health", rt.getNodeHealth)
	router.HandleFunc("GET /api/v1/divisions", rt.getDivisions)
	router.HandleFunc("GET /api/v1/divisions/{id}/summary", rt.getDivisionSummary)

	rt.Handler = router
}

func (rt *Router) defaultHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	w.Write([]byte("Welcome!!!"))
}

func (rt *Router) getHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	response := map[string]any{"status": "ok"}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("json encoding failed", slog.String("error", err.Error()))
	}
}

func (rt *Router) getLiveReadings(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("", "error", err)
		return
	}

	wsClient := ws.NewClient(conn, rt.clientBufferSize, rt.clientWriteDeadline, rt.clientReadDeadline, rt.clientPingInterval)
	rt.wsHub.Register(wsClient, rt.telemetryTopic)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	defer rt.wsHub.Kickout(wsClient, rt.telemetryTopic)

	go wsClient.Write(ctx)
	go wsClient.PingLoop(ctx)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (rt *Router) getNodeEvents(w http.ResponseWriter, r *http.Request) {
	if rt.state == nil {
		http.Error(w, "state not configured", http.StatusInternalServerError)
		return
	}

	nodeID := r.PathValue("id")
	limit := 20
	if q := r.URL.Query().Get("limit"); q != "" {
		parsed, err := strconv.Atoi(q)
		if err == nil && parsed > 0 {
			limit = parsed
		}
	}

	events := rt.state.GetEvents(nodeID, limit)
	w.Header().Set("Content-Type", types.JSONContentType)
	_ = json.NewEncoder(w).Encode(events)
}

func (rt *Router) getNodes(w http.ResponseWriter, r *http.Request) {
	if rt.state == nil {
		http.Error(w, "state not configured", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", types.JSONContentType)
	_ = json.NewEncoder(w).Encode(rt.state.ListNodes())
}

func (rt *Router) getNodeHealth(w http.ResponseWriter, r *http.Request) {
	if rt.state == nil {
		http.Error(w, "state not configured", http.StatusInternalServerError)
		return
	}

	nodeID := r.PathValue("id")
	health, ok := rt.state.GetHealth(nodeID)
	if !ok {
		health = stream.Health{
			NodeID:        nodeID,
			NodeType:      "unknown",
			Timestamp:     time.Now().UnixMilli(),
			SequenceNo:    0,
			Status:        "unknown",
			UptimeSec:     0,
			MQTTConnected: false,
			WiFiConnected: false,
			SensorOK:      false,
			BufferedCount: 0,
		}
	}

	w.Header().Set("Content-Type", types.JSONContentType)
	_ = json.NewEncoder(w).Encode(health)
}

const requestTimeout = 10 * time.Second

func (rt *Router) getDivisions(w http.ResponseWriter, r *http.Request) {
	if rt.divisionService == nil {
		http.Error(w, "division service not configured", http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	divisions, err := rt.divisionService.GetHierarchy(ctx)
	if err != nil {
		slog.Error("failed to fetch divisions", "error", err)
		http.Error(w, "failed to fetch divisions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", types.JSONContentType)
	json.NewEncoder(w).Encode(divisions)
}

func (rt *Router) getDivisionSummary(w http.ResponseWriter, r *http.Request) {
	if rt.divisionService == nil {
		http.Error(w, "division service not configured", http.StatusInternalServerError)
		return
	}

	idStr := r.PathValue("id")
	divisionID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid division id", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	summary, err := rt.divisionService.GetDivisionSummary(ctx, divisionID)
	if err != nil {
		slog.Error("failed to fetch division summary", "error", err, "division_id", divisionID)
		http.Error(w, "failed to fetch division summary", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", types.JSONContentType)
	json.NewEncoder(w).Encode(summary)
}
