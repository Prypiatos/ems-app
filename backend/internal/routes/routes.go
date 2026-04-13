package routes

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Prypiatos/energy-e3-app/backend/internal/models"
)

const (
	ONLINE           = "online"
	DEGRADED         = "degraded"
	OFFLINE_INTENDED = "offline_intended"
)

const jsonContentType = "application/json"

var ErrNodeNotFound = errors.New("Node not found")

type DeviceStore interface {
	GetDeviceHealth(node_id string) (models.HealthStatus, error)
	GetDeviceByID(node_id string) (models.Node, error)
	GetNodeList() []models.Node
}

type Server struct {
	store DeviceStore
	http.Handler
}

func NewServer(store DeviceStore) *Server {
	s := new(Server)
	s.store = store
	setupAPI(s)

	return s
}

func setupAPI(s *Server) {

	router := http.NewServeMux()

	router.HandleFunc("/", s.Home)
	router.HandleFunc("GET /health/{id}", s.GetHealthByID)
	router.HandleFunc("/nodes", s.GetNodes)
	router.HandleFunc("GET /nodes/{id}", s.GetNodeDetailsByID)
	router.HandleFunc("/energy/aggregate", s.GetAggregate)
	router.HandleFunc("/prediction", s.GetPrediction)
	router.HandleFunc("/anomalies", s.GetAnomalies)
	router.HandleFunc("/alerts", s.GetAlerts)

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

	if err == ErrNodeNotFound {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("content-type", jsonContentType)
	json.NewEncoder(w).Encode(healthStatus)
}

func (s *Server) GetNodes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("content-type", jsonContentType)
	json.NewEncoder(w).Encode(s.store.GetNodeList())
}

func (s *Server) GetNodeDetailsByID(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetAggregate(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetPrediction(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetAnomalies(w http.ResponseWriter, r *http.Request) {}

func (s *Server) GetAlerts(w http.ResponseWriter, r *http.Request) {}
