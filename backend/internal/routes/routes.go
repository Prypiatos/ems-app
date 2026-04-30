package routes

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/Prypiatos/shared-models/models"
)

type DeviceStore interface {
	GetDeviceHealth(node_id string) (models.HealthStatus, error)
	GetDeviceByID(node_id string) (models.Node, error)
	GetNodeList() []models.Node
}

type Server struct {
	store DeviceStore
	wsHub *ws.Hub
	http.Handler
}

func NewServer(store DeviceStore, wsHub *ws.Hub) *Server {
	s := new(Server)
	s.store = store
	s.wsHub = wsHub
	setupAPI(s)

	return s
}

func setupAPI(s *Server) {

	router := http.NewServeMux()

	router.HandleFunc("GET /", s.Home)
	router.HandleFunc("GET /health/{id}", s.GetHealthByID)
	router.HandleFunc("GET /nodes/{id}", s.GetNodeDetailsByID)
	router.HandleFunc("GET /nodes", s.GetNodes)
	router.HandleFunc("GET /energy/aggregate", s.GetAggregate)
	router.HandleFunc("GET /prediction", s.GetPrediction)
	router.HandleFunc("GET /anomalies", s.GetAnomalies)
	router.HandleFunc("GET /alerts", s.GetAlerts)
	router.HandleFunc("GET /readings", s.GetLiveReadings)

	s.Handler = router
}

func (s *Server) Home(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	w.Write([]byte("Welcome to Energy Management System"))
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
