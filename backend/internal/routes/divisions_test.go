package routes_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Prypiatos/ems-app/backend/internal/influx"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/service"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/Prypiatos/shared-models/models"
	"github.com/google/uuid"
)

// StubDeviceStore for testing
type stubDeviceStore struct{}

func (s *stubDeviceStore) GetDeviceHealth(node_id string) (models.HealthStatus, error) {
	return models.HealthStatus{}, nil
}

func (s *stubDeviceStore) GetDeviceByID(node_id string) (models.Node, error) {
	return models.Node{}, nil
}

func (s *stubDeviceStore) GetNodeList() []models.Node {
	return []models.Node{}
}

// TestGetDivisionsEndpointMissingService validates the endpoint when service is nil
func TestGetDivisionsEndpointMissingService(t *testing.T) {
	wsHub := ws.NewHub(nil)
	server := routes.NewServer(&stubDeviceStore{}, wsHub, nil)

	req := httptest.NewRequest("GET", "/api/v1/divisions", nil)
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when division service is nil, got %d", w.Code)
	}
}

// TestGetDivisionSummaryBadID validates bad UUID handling
func TestGetDivisionSummaryBadID(t *testing.T) {
	mockInflux := influx.NewMockClient()
	divService := service.NewDivisionService(nil, mockInflux)
	wsHub := ws.NewHub(nil)
	server := routes.NewServer(&stubDeviceStore{}, wsHub, divService)

	req := httptest.NewRequest("GET", "/api/v1/divisions/not-a-uuid/summary", nil)
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for bad UUID, got %d", w.Code)
	}
}

// TestGetDivisionSummaryValidID validates valid UUID format is accepted
func TestGetDivisionSummaryValidID(t *testing.T) {
	mockInflux := influx.NewMockClient()
	divService := service.NewDivisionService(nil, mockInflux)
	wsHub := ws.NewHub(nil)
	server := routes.NewServer(&stubDeviceStore{}, wsHub, divService)

	validID := uuid.New().String()
	req := httptest.NewRequest("GET", "/api/v1/divisions/"+validID+"/summary", nil)
	w := httptest.NewRecorder()

	server.ServeHTTP(w, req)

	// Should return 500 due to nil repo, not 400 (which means bad format)
	if w.Code == http.StatusBadRequest {
		t.Errorf("valid UUID rejected as bad request")
	}
	if w.Code == http.StatusInternalServerError {
		t.Logf("Got expected 500 error response for nil repo")
	}
}

// TestDivisionServiceCachingWithNilRepo validates cache behavior with nil repo
func TestDivisionServiceCachingWithNilRepo(t *testing.T) {
	mockInflux := influx.NewMockClient()
	divService := service.NewDivisionService(nil, mockInflux)

	// First call should fail because repo is nil
	_, err1 := divService.GetHierarchy(context.Background())
	if err1 == nil {
		t.Errorf("expected error with nil repo, got nil")
	}

	// Second call should also fail (not cached because first failed)
	_, err2 := divService.GetHierarchy(context.Background())
	if err2 == nil {
		t.Errorf("expected error with nil repo on second call, got nil")
	}
}
