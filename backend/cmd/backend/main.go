package main

import (
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/Prypiatos/ems-app/backend/internal/bootstrap"
	"github.com/Prypiatos/ems-app/backend/internal/db"
	"github.com/Prypiatos/ems-app/backend/internal/influx"
	"github.com/Prypiatos/ems-app/backend/internal/kafka"
	"github.com/Prypiatos/ems-app/backend/internal/repository"
	"github.com/Prypiatos/ems-app/backend/internal/routes"
	"github.com/Prypiatos/ems-app/backend/internal/service"
	"github.com/Prypiatos/ems-app/backend/internal/tools"
	"github.com/Prypiatos/ems-app/backend/internal/ws"
	"github.com/joho/godotenv"
)

func main() {

	// --- slog setup ---
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// --- context with SIGTERM handling ---
	ctx, cancel := tools.WithSignalCancel()
	defer cancel()

	_ = godotenv.Load()

	topics := []string{"energy.readings", "energy.anomalies", "energy.forecasts"}

	topicGroupMap := map[string]string{
		"energy.readings":  "energy-readings",
		"energy.anomalies": "energy-anomalies",
		"energy.forecasts": "energy-forecasts",
	}

	topicChannelMap := make(map[string]<-chan []byte)
	topicConsumerMap := make(map[string]kafka.Consumer)

	for k, v := range topicGroupMap {
		kafkaConsumer, err := kafka.NewConsumer(k, v)
		if err != nil {
			log.Println(err)
			return
		}
		topicConsumerMap[k] = kafkaConsumer
		topicChannelMap[k] = kafkaConsumer.Consume(ctx)
	}

	wsHub := ws.NewHub(topics)

	for _, topic := range topics {
		go wsHub.Broadcast(ctx, topic)
	}

	for _, topic := range topics {
		topicName := topic
		dataChan := topicChannelMap[topicName]

		go func() {
			for {
				select {
				case <-ctx.Done():
					log.Println("producer exit")
					return
				case msg := <-dataChan:
					select {
					case wsHub.Buffer[topicName] <- msg:
					case <-ctx.Done():
						return
					}
				}
			}
		}()
	}

	deviceStore := bootstrap.NewDeviceStore()

	// --- PostgreSQL setup for divisions ---
	pgConfig := db.PostgresConfig{
		Host:     os.Getenv("POSTGRES_HOST"),
		Port:     os.Getenv("POSTGRES_PORT"),
		User:     os.Getenv("POSTGRES_USER"),
		Password: os.Getenv("POSTGRES_PASSWORD"),
		Database: os.Getenv("POSTGRES_DB"),
		SSLMode:  os.Getenv("POSTGRES_SSLMODE"),
	}

	// Set defaults if not configured
	if pgConfig.Host == "" {
		pgConfig.Host = "localhost"
	}
	if pgConfig.Port == "" {
		pgConfig.Port = "5432"
	}
	if pgConfig.User == "" {
		pgConfig.User = "user"
	}
	if pgConfig.Password == "" {
		pgConfig.Password = "password"
	}
	if pgConfig.Database == "" {
		pgConfig.Database = "ems_db"
	}
	if pgConfig.SSLMode == "" {
		pgConfig.SSLMode = "disable"
	}

	var divisionService *service.DivisionService

	// Try to connect to PostgreSQL, but don't fail if unavailable
	pgDB, err := db.NewPostgresDB(pgConfig)
	if err != nil {
		slog.Warn("PostgreSQL connection failed, division endpoints will be unavailable", "error", err)
		divisionService = nil
	} else {
		defer pgDB.Close()

		// Initialize division repository and service
		divisionRepo := repository.NewDivisionRepository(pgDB)
		influxClient := influx.NewMockClient() // TODO: Replace with real InfluxDB client when available
		divisionService = service.NewDivisionService(divisionRepo, influxClient)

		slog.Info("Division service initialized with PostgreSQL backend")
	}

	server := routes.NewServer(deviceStore, wsHub, divisionService)

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
