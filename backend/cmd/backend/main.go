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

	kafkaConsumer, err := kafka.NewConsumer("energy.readings", "energy-readings")
	if err != nil {
		log.Println(err)
		return
	}

	dataChan := kafkaConsumer.Consume(ctx)

	wsHub := ws.NewHub()
	go wsHub.Broadcast(ctx)

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
