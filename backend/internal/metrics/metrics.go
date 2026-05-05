package metrics

import (
	"strconv"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	once     sync.Once
	instance *Metrics
	registry *prometheus.Registry
)

// Metrics holds the application Prometheus counters.
type Metrics struct {
	httpRequestTotal      *prometheus.CounterVec
	httpRequestErrorTotal *prometheus.CounterVec
}

// New initializes and returns a singleton Metrics instance with a custom registry.
func New() (*Metrics, error) {
	var err error
	once.Do(func() {
		registry = prometheus.NewRegistry()
		instance = newMetrics()
	})
	return instance, err
}

// GetInstance returns the singleton Metrics instance.
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

func newMetrics() *Metrics {
	m := &Metrics{
		httpRequestTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "api_http_request_total",
			Help: "Total number of requests processed by the API",
		}, []string{"path", "status"}),
		httpRequestErrorTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "api_http_request_error_total",
			Help: "Total number of errors returned by the API",
		}, []string{"path", "status"}),
	}

	registry.MustRegister(m.httpRequestTotal, m.httpRequestErrorTotal)
	return m
}

// RecordHTTPRequest records request metrics for the requested path and status.
func (m *Metrics) RecordHTTPRequest(path string, statusCode int) {
	status := strconv.Itoa(statusCode)
	if statusCode < 400 {
		m.httpRequestTotal.WithLabelValues(path, status).Inc()
		return
	}

	m.httpRequestErrorTotal.WithLabelValues(path, status).Inc()
}
