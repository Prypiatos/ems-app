package routes

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/service"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/google/uuid"
)

type Router struct {
	wsHub               *ws.Hub
	divisionService     *service.DivisionService
	clientBufferSize    int
	clientWriteDeadline time.Duration
	clientReadDeadline  time.Duration
	clientPingInterval  time.Duration
	http.Handler
}

func NewRouter(wsHub *ws.Hub, divisionService *service.DivisionService, clientBufferSize int, clientWriteDeadline time.Duration, clientReadDeadline time.Duration, clientPingInterval time.Duration) *Router {
	rt := new(Router)
	rt.wsHub = wsHub
	rt.divisionService = divisionService
	rt.clientBufferSize = clientBufferSize
	rt.clientWriteDeadline = clientWriteDeadline
	rt.clientReadDeadline = clientReadDeadline
	rt.clientPingInterval = clientPingInterval
	setupRoutes(rt)

	return rt
}

func setupRoutes(rt *Router) {
	router := http.NewServeMux()

	router.HandleFunc("GET /", rt.defaultHandler)
	router.HandleFunc("GET /api/v1/health", rt.getHealth)
	router.HandleFunc("GET /api/v1/readings", rt.getLiveReadings)
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

	response := map[string]any{
		"status": "ok",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		slog.Error("json encoding failed", slog.String("error", err.Error()))
	}
}

// consumes kafka topic and send data to websocket connection
func (rt *Router) getLiveReadings(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("", "error", err)
		return
	}

	wsClient := ws.NewClient(conn, rt.clientBufferSize, rt.clientWriteDeadline, rt.clientReadDeadline, rt.clientPingInterval)
	rt.wsHub.Register(wsClient, "energy.readings")

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	defer rt.wsHub.Kickout(wsClient, "energy.readings")

	go wsClient.Write(ctx)
	go wsClient.PingLoop(ctx)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

const requestTimeout = 10 * time.Second

// GetDivisions returns the hierarchical division tree.
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

// GetDivisionSummary returns a division with realtime metrics.
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
