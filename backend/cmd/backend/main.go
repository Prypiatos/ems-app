package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/kafka"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/tools"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/Prypiatos/shared-models/models"
)

func main() {

	// --- slog setup ---
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// --- context with SIGTERM handling ---
	ctx, cancel := tools.WithSignalCancel()

	// --- Kafka consumers ---
	consumerConfigs := []struct {
		topic   string
		groupID string
	}{
		{"energy.readings", "energy-readings"},
		{"energy.anomalies", "energy-anomalies"},
		{"energy.forecasts", "energy-forecasts"},
	}

	var (
		wg        sync.WaitGroup
		consumers []kafka.Consumer
	)

	for _, cfg := range consumerConfigs {
		c, err := kafka.NewConsumer(cfg.topic, cfg.groupID)
		if err != nil {
			slog.Error("failed to create consumer",
				"topic", cfg.topic,
				"error", err,
			)

			cancel()

			wg.Wait()
			return
		}

		consumers = append(consumers, c)

		wg.Add(1)
		go func(c kafka.Consumer) {
			defer wg.Done()
			defer func() {
				if closeErr := c.Close(); closeErr != nil {
					slog.Error("failed to close consumer", "error", closeErr)
				}
			}()

			kafka.Consume(ctx, c)
		}(c)
	}

	// Seed in-memory node metadata for local development.
	db := map[string]models.Node{
		"node_1": {NodeID: "node_1", NodeType: "typeA", Status: types.ONLINE},
		"node_2": {NodeID: "node_2", NodeType: "typeB", Status: types.DEGRADED},
		"node_3": {NodeID: "node_3", NodeType: "typeC", Status: types.OFFLINE_INTENDED},
	}

	// Seed latest health snapshots per node.
	healthRecords := map[string]models.HealthStatus{
		"node_1": {NodeID: "node_1", Status: types.ONLINE, Timestamp: 1713000000, Uptime: 86400, MQTTConnected: true, WifiConnected: true, SensorOK: true, BufferedCount: 0},
		"node_2": {NodeID: "node_2", Status: types.DEGRADED, Timestamp: 1713000100, Uptime: 86410, MQTTConnected: true, WifiConnected: false, SensorOK: true, BufferedCount: 2},
		"node_3": {NodeID: "node_3", Status: types.OFFLINE_INTENDED, Timestamp: 1713000200, Uptime: 86420, MQTTConnected: false, WifiConnected: false, SensorOK: false, BufferedCount: 8},
	}

	nodes := []models.Node{
		{NodeID: "node_1", NodeType: "typeA", Status: types.ONLINE},
		{NodeID: "node_2", NodeType: "typeB", Status: types.DEGRADED},
		{NodeID: "node_3", NodeType: "typeC", Status: types.OFFLINE_INTENDED},
	}

	deviceStore := &InMemoryDeviceStore{db: db, healthRecords: healthRecords, nodes: nodes}
	server := routes.NewServer(deviceStore, nil)

	// --- WebSocket hub ---
	wsHub := ws.NewHub(slog.Default())

	// Top-level mux: compose REST routes + WebSocket endpoint.
	// This keeps the ws package fully decoupled from routes.Server.
	topMux := http.NewServeMux()
	topMux.Handle("/", server)
	topMux.HandleFunc("GET /ws", ws.Handler(wsHub, slog.Default()))
	topMux.HandleFunc("GET /socket.io/", ws.SocketIOHandler(wsHub, slog.Default()))

	port := 8080
	addr := fmt.Sprintf(":%d", port)

	// --- HTTP server with graceful shutdown ---
	httpServer := &http.Server{
		Addr:    addr,
		Handler: topMux,
	}

	serverErrChan := make(chan error, 1)

	go func() {
		slog.Info("starting server", "addr", addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			select {
			case serverErrChan <- err:
			default:
			}
			cancel()
		}
	}()

	select {
	case <-ctx.Done():
	case err := <-serverErrChan:
		slog.Error("server error", "error", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	slog.Info("shutting down http server")
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown failed", "error", err)
	} else {
		slog.Info("server shutdown ok")
	}

	wg.Wait()

	slog.Info("shutdown complete")
}
