package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/config"
	"github.com/Prypiatos/ems-app/backend/internal/kafka"
	"github.com/Prypiatos/ems-app/backend/internal/middleware"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/stream"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
)

var newKafkaConsumer = func(ctx context.Context, topic, groupID string) (kafka.Consumer, error) {
	return kafka.NewConsumer(ctx, topic, groupID)
}

type Runtime struct {
	cfg config.Config
}

func New(cfg config.Config) *Runtime {
	return &Runtime{cfg: cfg}
}

func (rt *Runtime) Run(appCtx context.Context, stop context.CancelFunc) error {
	wsHub := ws.NewHub(rt.cfg.Topics, rt.cfg.HubBufferSize)
	state := stream.NewState()
	router := routes.NewRouterBuilder().
		WithWsHub(wsHub).
		WithTelemetryTopic(rt.cfg.TelemetryTopic).
		WithState(state).
		WithClientBufferSize(rt.cfg.ClientBufferSize).
		WithClientWriteDeadline(rt.cfg.ClientWriteDeadline).
		WithClientReadDeadline(rt.cfg.ClientReadDeadline).
		WithClientPingInterval(rt.cfg.ClientPingInterval).
		Build()

	router.Engine().Use(
		middleware.GinCORSMiddleware(),
		middleware.GinRecoveryMiddleware(),
		middleware.GinRequestIDMiddleware(),
		middleware.GinLoggingMiddleware(),
		middleware.GinWithAppContext(appCtx),
		middleware.GinPrometheusMiddleware(),
		middleware.GinJWTMiddleware(middleware.JWTConfig{
			IssuerURL:         os.Getenv("KEYCLOAK_ISSUER"),
			ExternalIssuerURL: os.Getenv("KEYCLOAK_ISSUER_EXTERNAL"),
			SkipPaths:         []string{"/", "/metrics", "/api/v1/health", "/api/v1/readings"},
		}),
	)

	server := &http.Server{Addr: rt.cfg.ServerAddr, Handler: router}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("starting server at", "addr", rt.cfg.ServerAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			stop()
		}
	}()

	var wg sync.WaitGroup
	var consumerMu sync.Mutex
	consumers := make(map[string]kafka.Consumer)
	defer func() {
		for _, consumer := range consumers {
			if err := consumer.Close(); err != nil {
				slog.Error("failed to close consumer", "error", err)
			}
		}
	}()

	for _, topic := range rt.cfg.Topics {
		topicName := topic
		wg.Go(func() { wsHub.Broadcast(appCtx, topicName) })
	}

	if rt.cfg.EnableTopicDiscovery {
		wg.Go(func() {
			ticker := time.NewTicker(5 * time.Second)
			defer ticker.Stop()
			for {
				startDiscoveredConsumers(appCtx, &wg, &consumerMu, consumers, wsHub, state, rt.cfg)
				select {
				case <-appCtx.Done():
					return
				case <-ticker.C:
				}
			}
		})
	}

	select {
	case <-appCtx.Done():
	case err := <-errCh:
		if err != nil {
			return err
		}
	}

	slog.Info("stopping server")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("failed to shutdown server", "error", err)
	}
	wg.Wait()
	return nil
}

func startDiscoveredConsumers(appCtx context.Context, wg *sync.WaitGroup, consumerMu *sync.Mutex, consumers map[string]kafka.Consumer, wsHub *ws.Hub, state *stream.State, cfg config.Config) {
	topics, err := kafka.ListTopics(appCtx)
	if err != nil {
		if appCtx.Err() == nil {
			slog.Warn("failed to list kafka topics", "error", err)
		}
		return
	}

	for _, topic := range topics {
		if !isValidNodeTopic(topic) {
			continue
		}
		if nodeID, ok := nodeIDFromTopic(topic); ok {
			state.MarkNode(nodeID)
		}

		consumerMu.Lock()
		_, exists := consumers[topic]
		consumerMu.Unlock()
		if exists {
			continue
		}

		groupID := groupIDForTopic(topic)
		consumer, err := newKafkaConsumer(appCtx, topic, groupID)
		if err != nil {
			if appCtx.Err() == nil {
				slog.Error("failed to start consumer", "topic", topic, "group", groupID, "error", err)
			}
			continue
		}

		consumerMu.Lock()
		consumers[topic] = consumer
		consumerMu.Unlock()

		wg.Go(func() {
			dataChan := consumer.Consume(appCtx)
			for {
				select {
				case <-appCtx.Done():
					return
				case record, ok := <-dataChan:
					if !ok {
						return
					}
					processRecord(appCtx, record, wsHub, state, cfg.PublishTimeout)
				}
			}
		})
		slog.Info("started dynamic consumer", "topic", topic, "group", groupID)
	}
}

func processRecord(appCtx context.Context, record kafka.Record, wsHub *ws.Hub, state *stream.State, publishTimeout time.Duration) {
	if !isValidNodeTopic(record.Topic) {
		slog.Warn("dropping invalid topic", "topic", record.Topic)
		return
	}

	nodeID, _ := nodeIDFromTopic(record.Topic)
	state.MarkNode(nodeID)

	switch {
	case strings.HasSuffix(record.Topic, ".telemetry"):
		if published := wsHub.Publish(appCtx, "telemetry", record.Value, publishTimeout); !published {
			slog.Warn("dropping telemetry message from ingest", "topic", record.Topic)
		}
	case strings.HasSuffix(record.Topic, ".events"):
		var event stream.Event
		if err := json.Unmarshal(record.Value, &event); err != nil {
			slog.Warn("dropping invalid event payload", "topic", record.Topic, "error", err)
			return
		}
		if event.NodeID != nodeID {
			slog.Warn("dropping event with mismatched node_id", "topic", record.Topic, "payload_node_id", event.NodeID)
			return
		}
		state.AddEvent(event)
	case strings.HasSuffix(record.Topic, ".health"):
		var health stream.Health
		if err := json.Unmarshal(record.Value, &health); err != nil {
			slog.Warn("dropping invalid health payload", "topic", record.Topic, "error", err)
			return
		}
		if health.NodeID != nodeID {
			slog.Warn("dropping health with mismatched node_id", "topic", record.Topic, "payload_node_id", health.NodeID)
			return
		}
		state.SetHealth(health)
	}
}

func groupIDForTopic(topic string) string {
	nodeID, _ := nodeIDFromTopic(topic)
	switch {
	case strings.HasSuffix(topic, ".telemetry"):
		return fmt.Sprintf("energy-telemetry-%s", nodeID)
	case strings.HasSuffix(topic, ".events"):
		return fmt.Sprintf("energy-events-%s", nodeID)
	case strings.HasSuffix(topic, ".health"):
		return fmt.Sprintf("energy-health-%s", nodeID)
	default:
		return "energy-generic"
	}
}

func isValidNodeTopic(topic string) bool {
	nodeID, ok := nodeIDFromTopic(topic)
	if !ok || nodeID == "" || len(nodeID) > 64 {
		return false
	}
	for _, ch := range nodeID {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_' {
			continue
		}
		return false
	}
	return strings.HasSuffix(topic, ".telemetry") || strings.HasSuffix(topic, ".events") || strings.HasSuffix(topic, ".health")
}

func nodeIDFromTopic(topic string) (string, bool) {
	const prefix = "energy.nodes."
	if !strings.HasPrefix(topic, prefix) {
		return "", false
	}
	rest := strings.TrimPrefix(topic, prefix)
	parts := strings.Split(rest, ".")
	if len(parts) != 2 {
		return "", false
	}
	return parts[0], true
}
