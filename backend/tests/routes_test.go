package tests

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/Prypiatos/shared-models/models"
	"github.com/gorilla/websocket"
)

func TestHome(t *testing.T) {

	server := routes.NewServer(&StubDeviceStore{}, nil)

	tests := []struct {
		name   string
		path   string
		status int
		body   string
	}{
		{"returns correct response", "/", http.StatusOK, "Welcome to Energy Management System"},
		{"return 404 for unknown path", "/unknonw", http.StatusNotFound, "404 page not found\n"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, test.path, nil)
			if err != nil {
				t.Fatal(err)
			}

			resp := httptest.NewRecorder()
			server.ServeHTTP(resp, req)

			assertStatusCode(t, resp.Code, test.status)
			assertResponseBody(t, resp.Body.String(), test.body)
		})
	}
}

func TestGetHealthByID(t *testing.T) {

	deviceStore := &StubDeviceStore{healthRecords: map[string]models.HealthStatus{
		"node_1": {NodeID: "node_1", Status: types.ONLINE, Timestamp: 1713000000, Uptime: 86400, MQTTConnected: true, WifiConnected: true, SensorOK: true, BufferedCount: 0},
		"node_2": {NodeID: "node_2", Status: types.DEGRADED, Timestamp: 1713000100, Uptime: 86410, MQTTConnected: true, WifiConnected: false, SensorOK: true, BufferedCount: 2},
		"node_3": {NodeID: "node_3", Status: types.OFFLINE_INTENDED, Timestamp: 1713000200, Uptime: 86420, MQTTConnected: false, WifiConnected: false, SensorOK: false, BufferedCount: 8},
	}}
	server := routes.NewServer(deviceStore, nil)

	tests := []struct {
		name   string
		path   string
		status int
		body   models.HealthStatus
	}{
		{"online node returns health payload", "/health/node_1", http.StatusOK, deviceStore.healthRecords["node_1"]},
		{"degraded node returns health payload", "/health/node_2", http.StatusOK, deviceStore.healthRecords["node_2"]},
		{"intended offline node returns health payload", "/health/node_3", http.StatusOK, deviceStore.healthRecords["node_3"]},
		{"invalid node_id should return 404", "/health/node_unknown", http.StatusNotFound, models.HealthStatus{}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, test.path, nil)
			if err != nil {
				t.Fatal(err)
			}

			resp := httptest.NewRecorder()
			server.ServeHTTP(resp, req)

			assertStatusCode(t, resp.Code, test.status)

			if resp.Code == http.StatusOK {
				got := getHealthFromResponse(t, resp.Body)
				assertContentType(t, resp, types.JSONContentType)
				assertHealthStatus(t, got, test.body)
			}

		})
	}

}

func TestGetNodes(t *testing.T) {

	t.Run("returns 200 on GET request", func(t *testing.T) {

		wantedNodes := []models.Node{
			{NodeID: "node_1", NodeType: "typeA", Status: types.ONLINE},
			{NodeID: "node_2", NodeType: "typeB", Status: types.DEGRADED},
			{NodeID: "node_3", NodeType: "typeC", Status: types.OFFLINE_INTENDED},
		}

		deviceStore := &StubDeviceStore{healthRecords: nil, nodes: wantedNodes}
		server := routes.NewServer(deviceStore, nil)

		req, err := http.NewRequest(http.MethodGet, "/nodes", nil)
		if err != nil {
			t.Fatal(err)
		}

		resp := httptest.NewRecorder()
		server.ServeHTTP(resp, req)

		got := getNodesFromResponse(t, resp.Body)

		assertStatusCode(t, resp.Code, http.StatusOK)
		assertContentType(t, resp, types.JSONContentType)
		assertNodes(t, got, wantedNodes)

	})
}

func TestGetNodeDetailsByID(t *testing.T) {

	deviceStore := &StubDeviceStore{db: map[string]models.Node{"node_1": {NodeID: "node_1", NodeType: "typeA", Status: types.ONLINE}}}
	server := routes.NewServer(deviceStore, nil)

	tests := []struct {
		name   string
		path   string
		status int
		body   models.Node
	}{
		{"valid node responds OK", "/nodes/node_1", http.StatusOK, deviceStore.db["node_1"]},
		{"invalid node_id should return 404", "/nodes/node_foo", http.StatusNotFound, models.Node{}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, test.path, nil)
			if err != nil {
				t.Fatal(err)
			}

			resp := httptest.NewRecorder()
			server.ServeHTTP(resp, req)

			assertStatusCode(t, resp.Code, test.status)

			if resp.Code == http.StatusOK {
				got := getDeviceFromResponse(t, resp.Body)
				assertContentType(t, resp, types.JSONContentType)
				assertDevice(t, got, test.body)
			}

		})
	}
}

func TestGetLiveReadings(t *testing.T) {
	topics := []string{"energy.readings", "energy.anomalies", "energy.forecasts"}
	t.Run("upgrades and unregisters client on disconnect", func(t *testing.T) {
		hub := ws.NewHub(topics)
		server := routes.NewServer(&StubDeviceStore{}, hub)
		ts := httptest.NewServer(server)
		defer ts.Close()

		ctx, cancel := context.WithCancel(context.Background())
		go hub.Broadcast(ctx, "energy.readings")
		defer cancel()

		wsURL := "ws" + ts.URL[len("http"):] + "/readings"
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
		hub := ws.NewHub(topics)
		server := routes.NewServer(&StubDeviceStore{}, hub)
		ts := httptest.NewServer(server)
		defer ts.Close()

		ctx, cancel := context.WithCancel(context.Background())
		go hub.Broadcast(ctx, "energy.readings")
		defer cancel()

		wsURL := "ws" + ts.URL[len("http"):] + "/readings"
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		if err != nil {
			t.Fatalf("websocket dial failed: %v", err)
		}
		defer conn.Close()

		waitForClientCount(t, hub, 1, time.Second, "energy.readings")

		want := []byte(`{"node_id":"node_1","power_w":120.5}`)
		hub.Buffer["energy.readings"] <- want

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

type StubDeviceStore struct {
	healthRecords map[string]models.HealthStatus
	db            map[string]models.Node
	nodes         []models.Node
}

func (s *StubDeviceStore) GetDeviceByID(node_id string) (models.Node, error) {
	if device, ok := s.db[node_id]; ok {
		return device, nil
	}
	return models.Node{}, types.ErrNodeNotFound
}

func (s *StubDeviceStore) GetNodeList() []models.Node {
	return s.nodes
}

func (s *StubDeviceStore) GetDeviceHealth(node_id string) (models.HealthStatus, error) {
	if health, ok := s.healthRecords[node_id]; ok {
		return health, nil
	}
	return models.HealthStatus{}, types.ErrNodeNotFound
}

func assertStatusCode(t testing.TB, got, want int) {
	t.Helper()
	if got != want {
		t.Errorf("handler returned incorrect status code: got %d want %d", got, want)
	}
}

func assertResponseBody(t testing.TB, got, want string) {
	t.Helper()
	if got != want {
		t.Errorf("handler returned unexpected body: got %q want %q", got, want)
	}
}

func assertContentType(t testing.TB, response *httptest.ResponseRecorder, want string) {
	t.Helper()
	if response.Result().Header.Get("Content-Type") != want {
		t.Errorf("response did not have Content-Type of %s, got %v", want, response.Result().Header)
	}
}

func assertNodes(t *testing.T, got []models.Node, wantedNodes []models.Node) {
	if !reflect.DeepEqual(got, wantedNodes) {
		t.Errorf("got %v want %v", got, wantedNodes)
	}
}

func assertHealthStatus(t *testing.T, got, want models.HealthStatus) {
	t.Helper()
	if !healthStatusEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
}

func healthStatusEqual(a, b models.HealthStatus) bool {
	return a.NodeID == b.NodeID &&
		a.Timestamp == b.Timestamp &&
		a.Status == b.Status &&
		a.Uptime == b.Uptime &&
		a.MQTTConnected == b.MQTTConnected &&
		a.WifiConnected == b.WifiConnected &&
		a.SensorOK == b.SensorOK &&
		a.BufferedCount == b.BufferedCount
}

func getNodesFromResponse(t testing.TB, body io.Reader) (nodes []models.Node) {
	t.Helper()

	err := json.NewDecoder(body).Decode(&nodes)
	if err != nil {
		t.Fatalf("Unable to parse response from server %q into slice of Node, '%v'", body, err)
	}

	return
}

func getHealthFromResponse(t testing.TB, body io.Reader) (health models.HealthStatus) {
	t.Helper()

	err := json.NewDecoder(body).Decode(&health)
	if err != nil {
		t.Fatalf("Unable to parse response from server %q into HealthStatus, '%v'", body, err)
	}

	return
}

func assertDevice(t *testing.T, got, want models.Node) {
	t.Helper()
	if !nodeEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
}

func nodeEqual(a, b models.Node) bool {
	return a.NodeID == b.NodeID &&
		a.NodeType == b.NodeType &&
		a.Status == b.Status
}

func getDeviceFromResponse(t testing.TB, body io.Reader) (node models.Node) {
	t.Helper()

	err := json.NewDecoder(body).Decode(&node)
	if err != nil {
		t.Fatalf("Unable to parse response from server %q into slice of Node, '%v'", body, err)
	}

	return
}

func waitForClientCount(t testing.TB, hub *ws.Hub, want int, timeout time.Duration, topic string) {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		hub.Mutex.Lock()
		got := len(hub.WSClients[topic])
		hub.Mutex.Unlock()

		if got == want {
			return
		}

		time.Sleep(10 * time.Millisecond)
	}

	hub.Mutex.Lock()
	got := len(hub.WSClients[topic])
	hub.Mutex.Unlock()
	t.Fatalf("timeout waiting for websocket clients count: got %d want %d", got, want)
}
