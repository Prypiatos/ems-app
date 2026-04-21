package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/bootstrap"
	"github.com/Prypiatos/ems-app/backend/internal/kafka"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/tools"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
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

	deviceStore := bootstrap.NewDeviceStore()
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

	var hijackedConns sync.Map

	// --- HTTP server with graceful shutdown ---
	httpServer := &http.Server{
		Addr:    addr,
		Handler: topMux,
		ConnState: func(conn net.Conn, state http.ConnState) {
			switch state {
			case http.StateHijacked:
				hijackedConns.Store(conn, struct{}{})
			case http.StateClosed:
				hijackedConns.Delete(conn)
			}
		},
	}

	httpServer.RegisterOnShutdown(func() {
		hijackedConns.Range(func(key, _ any) bool {
			conn, ok := key.(net.Conn)
			if !ok {
				return true
			}

			if err := conn.Close(); err != nil && !errors.Is(err, net.ErrClosed) {
				slog.Warn("closing hijacked connection during shutdown failed", "error", err)
			}
			hijackedConns.Delete(conn)

			return true
		})
	})

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
