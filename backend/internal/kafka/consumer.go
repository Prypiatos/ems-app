package kafka

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	ckafka "github.com/confluentinc/confluent-kafka-go/kafka"
)

func NewConsumer(topic, groupID string) (*ckafka.Consumer, error) {
	broker := getenv("KAFKA_BROKER", "localhost:9092")

	c, err := ckafka.NewConsumer(&ckafka.ConfigMap{
		"bootstrap.servers": broker,
		"group.id":          groupID,
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		return nil, err
	}

	if err := c.SubscribeTopics([]string{topic}, nil); err != nil {
		return nil, err
	}

	slog.Info("consumer created",
		"topic", topic,
		"group", groupID,
		"broker", broker,
	)

	return c, nil
}

func Consume(ctx context.Context, c *ckafka.Consumer) {
	for {
		select {
		case <-ctx.Done():
			slog.Info("consumer shutting down")
			return
		default:
			msg, err := c.ReadMessage(-1)
			if err == nil {
				slog.Info("message consumed",
					"topic", *msg.TopicPartition.Topic,
					"partition", msg.TopicPartition.Partition,
					"offset", msg.TopicPartition.Offset,
				)
			} else {
				slog.Error("consumer error", "error", err)
			}
		}
	}
}

func WithSignalCancel() context.Context {
	ctx, cancel := context.WithCancel(context.Background())

	go func() {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
		<-ch
		slog.Info("signal received, cancelling context")
		cancel()
	}()

	return ctx
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
