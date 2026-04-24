package main

import (
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"

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
	defer cancel()

	topics := []string{"energy.readings", "energy.anomalies", "energy.forecasts"}

	topicGroupMap := map[string]string{
		"energy.readings":  "energy-readings",
		"energy.anomalies": "energy-anomalies",
		"energy.forecasts": "energy-forecasts",
	}

	topicChannelMap := make(map[string]<-chan []byte)
	topicConsumerMap := make(map[string]*kafka.ConfluentConsumer)

	for k, v := range topicGroupMap {
		kafkaConsumer, err := kafka.NewConsumer(k, v)
		if err != nil {
			log.Println(err)
			return
		}
		topicConsumerMap[k] = kafkaConsumer
		topicChannelMap[k] = kafkaConsumer.Consume(ctx)
	}

	dataChan := topicChannelMap["energy.readings"]

	wsHub := ws.NewHub(topics)

	for _, topic := range topics {
		go wsHub.Broadcast(ctx, topic)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Println("producer exit")
				return
			case msg := <-dataChan:
				select {
				case wsHub.Buffer <- msg:
				default:
					log.Println("buffer full. dropping old message")
					<-wsHub.Buffer
					wsHub.Buffer <- msg

				}
			}
		}
	}()

	deviceStore := bootstrap.NewDeviceStore()
	server := routes.NewServer(deviceStore, wsHub)

	mux := http.NewServeMux()
	mux.Handle("/", server)

	port := 8080
	addr := fmt.Sprintf(":%d", port)

	serverErrChan := make(chan error, 1)

	go func() {
		slog.Info("starting server", "addr", addr)
		if err := http.ListenAndServe(addr, mux); err != nil && !errors.Is(err, http.ErrServerClosed) {
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

	slog.Info("shutdown complete")
}
