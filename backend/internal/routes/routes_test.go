package routes

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appmetrics "github.com/Prypiatos/ems-app/backend/internal/metrics"
	"github.com/Prypiatos/ems-app/backend/internal/middleware"
	"github.com/Prypiatos/ems-app/backend/internal/stream"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func TestRouterHealthAndRootHandlers(t *testing.T) {
	router := NewRouterBuilder().
		WithWsHub(ws.NewHub([]string{"energy.readings"}, 1)).
		WithTelemetryTopic("energy.readings").
		WithState(stream.NewState()).
		WithClientBufferSize(1).
		WithClientWriteDeadline(time.Second).
		WithClientReadDeadline(time.Second).
		WithClientPingInterval(time.Second).
		Build()

	t.Run("root", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if body := rec.Body.String(); body != "Welcome!!!" {
			t.Fatalf("body = %q, want %q", body, "Welcome!!!")
		}
	})

	t.Run("health", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if contentType := rec.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
			t.Fatalf("Content-Type = %q, want application/json", contentType)
		}
		var payload map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode health body: %v", err)
		}
		if payload["status"] != "ok" {
			t.Fatalf("status = %v, want ok", payload["status"])
		}
	})
}

func TestRouterWebsocketReadingsRouteUpgrades(t *testing.T) {
	router := NewRouterBuilder().
		WithWsHub(ws.NewHub([]string{"energy.readings"}, 1)).
		WithTelemetryTopic("energy.readings").
		WithState(stream.NewState()).
		WithClientBufferSize(1).
		WithClientWriteDeadline(time.Second).
		WithClientReadDeadline(time.Second).
		WithClientPingInterval(0).
		Build()
	server := httptest.NewServer(router)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/readings"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("websocket dial: %v", err)
	}
	defer conn.Close()
}

func TestRouterMetricsEndpointExposesCustomCounters(t *testing.T) {
	if _, err := appmetrics.New(); err != nil {
		t.Fatalf("init metrics: %v", err)
	}

	router := NewRouterBuilder().
		WithWsHub(ws.NewHub([]string{"energy.readings"}, 1)).
		WithTelemetryTopic("energy.readings").
		WithState(stream.NewState()).
		WithClientBufferSize(1).
		WithClientWriteDeadline(time.Second).
		WithClientReadDeadline(time.Second).
		WithClientPingInterval(time.Second).
		Build()
	router.Engine().Use(middleware.GinPrometheusMiddleware())
	router.Engine().GET("/probe", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	server := httptest.NewServer(router)
	defer server.Close()

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(server.URL + "/probe")
	if err != nil {
		t.Fatalf("probe request: %v", err)
	}
	resp.Body.Close()

	resp, err = client.Get(server.URL + "/missing")
	if err != nil {
		t.Fatalf("error request: %v", err)
	}
	resp.Body.Close()

	resp, err = client.Get(server.URL + "/metrics")
	if err != nil {
		t.Fatalf("metrics request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read metrics body: %v", err)
	}

	metricsBody := string(body)
	if !strings.Contains(metricsBody, "api_http_request_total{path=\"/probe\",status=\"204\"} 1") {
		t.Fatalf("metrics output missing request total counter:\n%s", metricsBody)
	}
	if !strings.Contains(metricsBody, "api_http_request_error_total{path=\"/missing\",status=\"404\"} 1") {
		t.Fatalf("metrics output missing error counter:\n%s", metricsBody)
	}
	if strings.Contains(metricsBody, "go_gc_duration_seconds") || strings.Contains(metricsBody, "process_cpu_seconds_total") {
		t.Fatalf("metrics output includes default process metrics:\n%s", metricsBody)
	}
}
