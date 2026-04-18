package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/kafka"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/tools"
	"github.com/Prypiatos/ems-app/backend/internal/types"
	"github.com/Prypiatos/shared-models/models"
)

func main() {

	// --- slog setup ---
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// --- context with SIGTERM handling ---
	ctx := tools.WithSignalCancel()

	// --- Kafka consumers ---
	consumers := []struct {
		topic   string
		groupID string
	}{
		{"energy.readings", "energy-readings"},
		{"energy.anomalies", "energy-anomalies"},
		{"energy.forecasts", "energy-forecasts"},
	}

	var wg sync.WaitGroup

	for _, cfg := range consumers {
		c, err := kafka.NewConsumer(cfg.topic, cfg.groupID)
		if err != nil {
			log.Fatalf("failed to create consumer: %v", err)
		}
		wg.Go(func() { kafka.Consume(ctx, c) })
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

	port := 8080
	addr := fmt.Sprintf(":%d", port)

	// --- HTTP server with graceful shutdown ---
	httpServer := &http.Server{
		Addr:    addr,
		Handler: server,
	}

	go func() {
		slog.Info("starting server", "addr", addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	slog.Info("shutting down http server")
	_ = httpServer.Shutdown(shutdownCtx)
	wg.Wait()
	
	slog.Info("shutdown complete")
}
