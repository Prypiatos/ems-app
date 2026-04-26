package routes

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/shared-models/models"
	"github.com/gorilla/websocket"
)

type DeviceStore interface {
	GetDeviceHealth(node_id string) (models.HealthStatus, error)
	GetDeviceByID(node_id string) (models.Node, error)
	GetNodeList() []models.Node
}

type StreamResult struct {
	Data  []byte
	Error error
}
type StreamClient interface {
	Consume(ctx context.Context) <-chan StreamResult
}

type PostgresHealthChecker interface {
	Ping(ctx context.Context) error
}

type Server struct {
	stream          StreamClient
	store           DeviceStore
	postgresChecker PostgresHealthChecker
	http.Handler
}

func NewServer(store DeviceStore, stream StreamClient) *Server {
	s := new(Server)
	s.store = store
	s.stream = stream
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

	s.Handler = router
}

func (s *Server) SetPostgresHealthChecker(checker PostgresHealthChecker) {
	s.postgresChecker = checker
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
		"status":   "ok",
		"postgres": "up",
	}

	if s.postgresChecker == nil {
		response["status"] = "degraded"
		response["postgres"] = "unconfigured"
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(response)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := s.postgresChecker.Ping(ctx); err != nil {
		response["status"] = "degraded"
		response["postgres"] = "down"
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(response)
		return
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

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func (s *Server) GetLiveReadings(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	results := s.stream.Consume(r.Context())

	for res := range results {
		if res.Error != nil {
			log.Printf("Closing WS: Stream failure: %v", res.Error)

			msg := websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Stream Unavailable")
			conn.WriteMessage(websocket.CloseMessage, msg)
			return
		}

		if err := conn.WriteMessage(websocket.TextMessage, res.Data); err != nil {
			return
		}

	}

}
