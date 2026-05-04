package app

import (
	"context"
	"errors"
	"log/slog"

	"net/http"
	"sync"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/config"
	"github.com/Prypiatos/ems-app/backend/internal/kafka"
	"github.com/Prypiatos/ems-app/backend/internal/middleware"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
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
	router := routes.NewRouter(wsHub, nil, rt.cfg.ClientBufferSize, rt.cfg.ClientWriteDeadline, rt.cfg.ClientReadDeadline, rt.cfg.ClientPingInterval)
	mux := http.NewServeMux()
	mux.Handle("/", router)

	handler := middleware.Chain(
		mux,
		middleware.RecoveryMiddleware(),
		middleware.RequestIDMiddleware(),
		middleware.LoggingMiddleware(),
		middleware.WithAppContext(appCtx),
	)

	server := &http.Server{
		Addr:    rt.cfg.ServerAddr,
		Handler: handler,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("starting server", "addr", rt.cfg.ServerAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			stop()
		}
	}()

	var wg sync.WaitGroup
	var consumerMu sync.Mutex
	consumers := make([]kafka.Consumer, 0, len(rt.cfg.TopicGroups))
	defer func() {
		for _, consumer := range consumers {
			if err := consumer.Close(); err != nil {
				slog.Error("failed to close consumer", "error", err)
			}
		}
	}()

	for _, topic := range rt.cfg.Topics {
		topicName := topic
		wg.Go(func() {
			wsHub.Broadcast(appCtx, topicName)
		})
	}

	for topic, groupID := range rt.cfg.TopicGroups {
		topicName := topic
		groupName := groupID
		wg.Go(func() {
			consumer, err := newKafkaConsumer(appCtx, topicName, groupName)
			if err != nil {
				if appCtx.Err() == nil {
					slog.Error("failed to start consumer", "topic", topicName, "group", groupName, "error", err)
				}
				return
			}

			consumerMu.Lock()
			consumers = append(consumers, consumer)
			consumerMu.Unlock()

			dataChan := consumer.Consume(appCtx)
			for {
				select {
				case <-appCtx.Done():
					return
				case msg, ok := <-dataChan:
					if !ok {
						return
					}
					if published := wsHub.Publish(appCtx, topicName, msg, rt.cfg.PublishTimeout); !published {
						slog.Warn("dropping message from ingest",
							"topic", topicName,
						)
					}
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
