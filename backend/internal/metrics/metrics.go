package metrics

import (
	"fmt"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	once     sync.Once
	instance *Metrics
	registry *prometheus.Registry
)

// Metrics holds all Prometheus metrics for the application.
type Metrics struct {
	httpRequestsTotal     *prometheus.CounterVec
	httpRequestDuration   *prometheus.HistogramVec
	httpRequestErrors     *prometheus.CounterVec
	wsConnectionsActive   prometheus.Gauge
	wsMessagesTotal       prometheus.Counter
	wsConnectionsTotal    prometheus.Counter
	wsDisconnectionsTotal prometheus.Counter
}

// New initializes and returns a singleton Metrics instance with a custom registry.
// This should be called once during application startup.
func New() (*Metrics, error) {
	var err error
	once.Do(func() {
		registry = prometheus.NewRegistry()
		instance, err = newMetrics()
	})
	return instance, err
}

// GetInstance returns the singleton Metrics instance.
// Panics if New() hasn't been called yet.
func GetInstance() *Metrics {
	if instance == nil {
		panic("metrics not initialized - call metrics.New() during startup")
	}
	return instance
}

// GetRegistry returns the custom Prometheus registry containing all application metrics.
func GetRegistry() prometheus.Gatherer {
	if registry == nil {
		panic("metrics not initialized - call metrics.New() during startup")
	}
	return registry
}

func newMetrics() (*Metrics, error) {
	m := &Metrics{
		httpRequestsTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests processed",
		}, []string{"method", "path", "status"}),
		httpRequestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds",
			Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2, 5},
		}, []string{"method", "path"}),
		httpRequestErrors: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "http_request_errors_total",
			Help: "Total number of HTTP requests with status code >= 400",
		}, []string{"method", "path", "status"}),
		wsConnectionsActive: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "websocket_connections_active",
			Help: "Number of active WebSocket connections",
		}),
		wsMessagesTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "websocket_messages_total",
			Help: "Total number of WebSocket messages sent and received",
		}),
		wsConnectionsTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "websocket_connections_total",
			Help: "Total number of WebSocket connections established",
		}),
		wsDisconnectionsTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "websocket_disconnections_total",
			Help: "Total number of WebSocket disconnections",
		}),
	}

	// Register all metrics with the custom registry
	collectors := []prometheus.Collector{
		m.httpRequestsTotal,
		m.httpRequestDuration,
		m.httpRequestErrors,
		m.wsConnectionsActive,
		m.wsMessagesTotal,
		m.wsConnectionsTotal,
		m.wsDisconnectionsTotal,
	}

	for _, metric := range collectors {
		if err := registry.Register(metric); err != nil {
			return nil, err
		}
	}

	return m, nil
}

// RecordHTTPRequest records HTTP request metrics.
func (m *Metrics) RecordHTTPRequest(method, path string, statusCode int, durationSeconds float64) {
	statusStr := fmt.Sprintf("%d", statusCode)
	m.httpRequestsTotal.WithLabelValues(method, path, statusStr).Inc()
	m.httpRequestDuration.WithLabelValues(method, path).Observe(durationSeconds)

	if statusCode >= 400 {
		m.httpRequestErrors.WithLabelValues(method, path, statusStr).Inc()
	}
}

// RecordWebSocketConnect records a WebSocket connection.
func (m *Metrics) RecordWebSocketConnect() {
	m.wsConnectionsTotal.Inc()
	m.wsConnectionsActive.Inc()
}

// RecordWebSocketDisconnect records a WebSocket disconnection.
func (m *Metrics) RecordWebSocketDisconnect() {
	m.wsDisconnectionsTotal.Inc()
	m.wsConnectionsActive.Dec()
}

// RecordWebSocketMessage records a WebSocket message.
func (m *Metrics) RecordWebSocketMessage() {
	m.wsMessagesTotal.Inc()
}
