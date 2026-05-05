package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ems_http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ems_http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	wsActiveConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "ems_websocket_active_connections",
			Help: "Number of active WebSocket connections",
		},
	)
)

// PrometheusMiddleware records request count and duration for every HTTP request.
func PrometheusMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			rw := &responseWriter{
				ResponseWriter: w,
				status:         http.StatusOK,
			}

			next.ServeHTTP(rw, r)

			duration := time.Since(start).Seconds()
			path := r.URL.Path

			httpRequestsTotal.WithLabelValues(r.Method, path, strconv.Itoa(rw.status)).Inc()
			httpRequestDuration.WithLabelValues(r.Method, path).Observe(duration)
		})
	}
}

// IncWebSocketConnections increments the active WebSocket connection gauge.
func IncWebSocketConnections() {
	wsActiveConnections.Inc()
}

// DecWebSocketConnections decrements the active WebSocket connection gauge.
func DecWebSocketConnections() {
	wsActiveConnections.Dec()
}
