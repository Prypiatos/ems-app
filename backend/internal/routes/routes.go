package routes

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/Prypiatos/shared-models/models"
	"github.com/gorilla/websocket"
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

type StreamResult struct {
	Data  []byte
	Error error
}
type StreamClient interface {
	Consume(ctx context.Context) <-chan StreamResult
}

type Server struct {
	stream StreamClient
	store  DeviceStore
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

	router.HandleFunc("/", s.Home)
	router.HandleFunc("GET /health/{id}", s.GetHealthByID)
	router.HandleFunc("GET /nodes/{id}", s.GetNodeDetailsByID)
	router.HandleFunc("/nodes", s.GetNodes)
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

func (s *Server) GetNodeDetailsByID(w http.ResponseWriter, r *http.Request) {
	node_id := r.PathValue("id")

	device, err := s.store.GetDeviceByID(node_id)

	if err == ErrNodeNotFound {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("content-type", jsonContentType)
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
