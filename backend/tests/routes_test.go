package tests

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/Prypiatos/energy-e3-app/backend/internal/models"
	"github.com/Prypiatos/energy-e3-app/backend/internal/routes"
)

const jsonContentType = "application/json"

func TestHome(t *testing.T) {

	server := routes.NewServer(&StubDeviceStore{})

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
		"node_1": {NodeID: "node_1", Status: routes.ONLINE, Timestamp: 1713000000, Uptime: 86400, MQTTConnected: true, WifiConnected: true, SensorOK: true, BufferedCount: 0},
		"node_2": {NodeID: "node_2", Status: routes.DEGRADED, Timestamp: 1713000100, Uptime: 86410, MQTTConnected: true, WifiConnected: false, SensorOK: true, BufferedCount: 2},
		"node_3": {NodeID: "node_3", Status: routes.OFFLINE_INTENDED, Timestamp: 1713000200, Uptime: 86420, MQTTConnected: false, WifiConnected: false, SensorOK: false, BufferedCount: 8},
	}}
	server := routes.NewServer(deviceStore)

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
				assertContentType(t, resp, jsonContentType)
				assertHealthStatus(t, got, test.body)
			}

		})
	}

}

func TestGetNodes(t *testing.T) {

	t.Run("returns 200 on GET request", func(t *testing.T) {

		wantedNodes := []models.Node{
			{NodeID: "node_1", NodeType: "typeA", Status: routes.ONLINE},
			{NodeID: "node_2", NodeType: "typeB", Status: routes.DEGRADED},
			{NodeID: "node_3", NodeType: "typeC", Status: routes.OFFLINE_INTENDED},
		}

		deviceStore := &StubDeviceStore{healthRecords: nil, nodes: wantedNodes}
		server := routes.NewServer(deviceStore)

		req, err := http.NewRequest(http.MethodGet, "/nodes", nil)
		if err != nil {
			t.Fatal(err)
		}

		resp := httptest.NewRecorder()
		server.ServeHTTP(resp, req)

		got := getNodesFromResponse(t, resp.Body)

		assertStatusCode(t, resp.Code, http.StatusOK)
		assertContentType(t, resp, jsonContentType)
		assertNodes(t, got, wantedNodes)

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
	return models.Node{}, routes.ErrNodeNotFound
}

func (s *StubDeviceStore) GetNodeList() []models.Node {
	return s.nodes
}

func (s *StubDeviceStore) GetDeviceHealth(node_id string) (models.HealthStatus, error) {
	if health, ok := s.healthRecords[node_id]; ok {
		return health, nil
	}
	return models.HealthStatus{}, routes.ErrNodeNotFound
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
	if response.Result().Header.Get("content-type") != want {
		t.Errorf("response did not have content-type of %s, got %v", want, response.Result().Header)
	}
}

func assertNodes(t *testing.T, got []models.Node, wantedNodes []models.Node) {
	if !reflect.DeepEqual(got, wantedNodes) {
		t.Errorf("got %v want %v", got, wantedNodes)
	}
}

func assertHealthStatus(t *testing.T, got, want models.HealthStatus) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v want %v", got, want)
	}
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
