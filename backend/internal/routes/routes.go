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
	"github.com/Prypiatos/shared-models/models"
	"github.com/google/uuid"
)

const requestTimeout = 10 * time.Second

type DeviceStore interface {
	GetDeviceHealth(node_id string) (models.HealthStatus, error)
	GetDeviceByID(node_id string) (models.Node, error)
	GetNodeList() []models.Node
}

type Server struct {
	store           DeviceStore
	wsHub           *ws.Hub
	divisionService *service.DivisionService
	http.Handler
}

func NewServer(store DeviceStore, wsHub *ws.Hub, divisionService *service.DivisionService) *Server {
	s := new(Server)
	s.store = store
	s.wsHub = wsHub
	s.divisionService = divisionService
	setupAPI(s)

	return s
}

func setupAPI(s *Server) {

	router := http.NewServeMux()

	router.HandleFunc("GET /", s.Home)
	router.HandleFunc("GET /health", s.GetHealth)
	router.HandleFunc("GET /health/{id}", s.GetHealthByID)
	router.HandleFunc("GET /nodes/{id}", s.GetNodeDetailsByID)
	router.HandleFunc("GET /nodes", s.GetNodes)
	router.HandleFunc("GET /energy/aggregate", s.GetAggregate)
	router.HandleFunc("GET /prediction", s.GetPrediction)
	router.HandleFunc("GET /anomalies", s.GetAnomalies)
	router.HandleFunc("GET /alerts", s.GetAlerts)
	router.HandleFunc("GET /readings", s.GetLiveReadings)

	// Division endpoints
	router.HandleFunc("GET /api/v1/divisions", s.GetDivisions)
	router.HandleFunc("GET /api/v1/divisions/{id}/summary", s.GetDivisionSummary)

	s.Handler = router
}

func (s *Server) Home(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	w.Write([]byte("Welcome to Energy Management System"))
}

func (s *Server) GetHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", types.JSONContentType)

	response := map[string]any{
		"status": "ok",
	}

	_ = json.NewEncoder(w).Encode(response)
}

func (s *Server) GetHealthByID(w http.ResponseWriter, r *http.Request) {
	node_id := r.PathValue("id")

	healthStatus, err := s.store.GetDeviceHealth(node_id)

	if err == types.ErrNodeNotFound {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", types.JSONContentType)
	json.NewEncoder(w).Encode(healthStatus)
}

func (s *Server) GetNodes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", types.JSONContentType)
	json.NewEncoder(w).Encode(s.store.GetNodeList())
}

func (s *Server) GetNodeDetailsByID(w http.ResponseWriter, r *http.Request) {
	node_id := r.PathValue("id")

	device, err := s.store.GetDeviceByID(node_id)

	if err == types.ErrNodeNotFound {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", types.JSONContentType)
	json.NewEncoder(w).Encode(device)
}

func (s *Server) GetAggregate(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetPrediction(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetAnomalies(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetAlerts(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetLiveReadings(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("", "error", err)
		return
	}

	wsClient := ws.NewClient(conn)
	s.wsHub.Register(wsClient, "energy.readings")

	ctx, cancel := context.WithCancel(r.Context())

	go wsClient.Write(ctx)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
	cancel()

	s.wsHub.Kickout(wsClient, "energy.readings")
}

// GetDivisions returns the hierarchical division tree.
func (s *Server) GetDivisions(w http.ResponseWriter, r *http.Request) {
	if s.divisionService == nil {
		http.Error(w, "division service not configured", http.StatusInternalServerError)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
	defer cancel()

	divisions, err := s.divisionService.GetHierarchy(ctx)
	if err != nil {
		slog.Error("failed to fetch divisions", "error", err)
		http.Error(w, "failed to fetch divisions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": divisions})
}

// GetDivisionSummary returns a division with realtime metrics.
func (s *Server) GetDivisionSummary(w http.ResponseWriter, r *http.Request) {
	if s.divisionService == nil {
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

	summary, err := s.divisionService.GetDivisionSummary(ctx, divisionID)
	if err != nil {
		slog.Error("failed to fetch division summary", "error", err, "division_id", divisionID)
		http.Error(w, "failed to fetch division summary", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}
