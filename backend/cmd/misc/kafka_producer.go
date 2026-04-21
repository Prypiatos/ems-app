package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

type EnergyReading struct {
	ReadingID   string   `json:"reading_id"`
	DeviceID    string   `json:"device_id"`
	DivisionID  string   `json:"division_id"`
	Timestamp   int64    `json:"timestamp"` // unix millis
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

	return EnergyReading{
		ReadingID:   uuid.New().String(),
		DeviceID:    fmt.Sprintf("DEV-%03d", rand.Intn(10)+1),
		DivisionID:  []string{"DIV-ENGINEERING", "DIV-OPERATIONS", "DIV-FINANCE"}[rand.Intn(3)],
		Timestamp:   time.Now().UnixMilli(),
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

	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": bootstrapServers,
		"client.id":         "go-mock-producer",
	})
	if err != nil {
		log.Fatalf("Failed to create producer: %s\n", err)
	}
	defer p.Close()

	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	deliveryChan := make(chan kafka.Event)

	go func() {
		for e := range deliveryChan {
			switch ev := e.(type) {
			case *kafka.Message:
				if ev.TopicPartition.Error != nil {
					fmt.Printf("Delivery failed: %v\n", ev.TopicPartition.Error)
				} else {
					fmt.Printf("Delivered to %s [%d] @ offset %v\n",
						*ev.TopicPartition.Topic,
						ev.TopicPartition.Partition,
						ev.TopicPartition.Offset)
				}
			}
		}
	}()

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

			err = p.Produce(&kafka.Message{
				TopicPartition: kafka.TopicPartition{
					Topic:     &topic,
					Partition: kafka.PartitionAny,
				},
				Key:   []byte(payload.DeviceID),
				Value: value,
			}, deliveryChan)

			if err != nil {
				fmt.Printf("Produce error: %v\n", err)
			}

			time.Sleep(1 * time.Second)
		}
	}

	close(deliveryChan)
	p.Flush(5000)
}
