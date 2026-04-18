package kafka

import (
	"context"
	"log/slog"

	"github.com/Prypiatos/ems-app/backend/internal/tools"
	ckafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func NewConsumer(topic, groupID string) (*ckafka.Consumer, error) {
	broker := tools.Getenv("KAFKA_BROKER", "localhost:9092")

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
	defer func() {
		if err := c.Close(); err != nil {
			slog.Error("consumer Close error", "error", err)
		}
	}()
	for {
		select {
		case <-ctx.Done():
			slog.Info("consumer shutting down")
			return
		default:

			ev := c.Poll(100)
			if ev == nil {
				continue
			}

			switch e := ev.(type) {
			case *ckafka.Message:
				slog.Info("message consumed",
					"topic", *e.TopicPartition.Topic,
					"partition", e.TopicPartition.Partition,
					"offset", e.TopicPartition.Offset,
				)
			case ckafka.Error:
				slog.Error("consumer error", "error", e)
			}
		}
	}
}
