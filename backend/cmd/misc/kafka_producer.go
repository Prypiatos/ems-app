package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	skafka "github.com/segmentio/kafka-go"
)

type EnergyReading struct {
	ReadingID   string   `json:"reading_id"`
	DeviceID    string   `json:"device_id"`
	DivisionID  string   `json:"division_id"`
	Timestamp   int64    `json:"timestamp"` // unix millis
	TsMs        int64    `json:"ts_ms"`
	EnergyKWh   float64  `json:"energy_kwh"`
	VoltageV    *float64 `json:"voltage_v,omitempty"`
	CurrentA    *float64 `json:"current_a,omitempty"`
	PowerFactor *float64 `json:"power_factor,omitempty"`
	Source      string   `json:"source"`
}

func randomFloat(min, max float64) float64 {
	return min + rand.Float64()*(max-min)
}

func RandomEnergyReading() EnergyReading {
	v := randomFloat(220, 240)
	c := randomFloat(5, 100)
	pf := randomFloat(0.8, 1.0)
	now := time.Now().UnixMilli()

	return EnergyReading{
		ReadingID:   uuid.New().String(),
		DeviceID:    fmt.Sprintf("DEV-%03d", rand.Intn(10)+1),
		DivisionID:  []string{"DIV-ENGINEERING", "DIV-OPERATIONS", "DIV-FINANCE"}[rand.Intn(3)],
		Timestamp:   now,
		TsMs:        now,
		EnergyKWh:   randomFloat(0.5, 20.0),
		VoltageV:    &v,
		CurrentA:    &c,
		PowerFactor: &pf,
		Source:      "METER",
	}
}

func main() {
	rand.Seed(time.Now().UnixNano())

	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using defaults")
	}

	bootstrapServers := os.Getenv("BOOTSTRAP_SERVERS")
	if bootstrapServers == "" {
		bootstrapServers = "localhost:9092"
	}

	topic := os.Getenv("TOPIC_NAME")
	if topic == "" {
		topic = "energy.readings"
	}

	brokers := strings.Split(bootstrapServers, ",")
	writer := &skafka.Writer{
		Addr:     skafka.TCP(brokers...),
		Topic:    topic,
		Balancer: &skafka.LeastBytes{},
	}
	defer func() {
		if err := writer.Close(); err != nil {
			log.Printf("Failed to close writer: %v", err)
		}
	}()

	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	run := true
	for run {
		select {
		case sig := <-sigchan:
			fmt.Printf("Caught signal %v, shutting down\n", sig)
			run = false
		default:
			payload := RandomEnergyReading()

			value, err := json.Marshal(payload)
			if err != nil {
				fmt.Printf("Marshal error: %v\n", err)
				continue
			}

			err = writer.WriteMessages(context.Background(), skafka.Message{
				Key:   []byte(payload.DeviceID),
				Value: value,
				Time:  time.Now(),
			})
			if err != nil {
				fmt.Printf("Produce error: %v\n", err)
			} else {
				fmt.Printf("Delivered message for device %s\n", payload.DeviceID)
			}

			time.Sleep(1 * time.Second)
		}
	}
}
