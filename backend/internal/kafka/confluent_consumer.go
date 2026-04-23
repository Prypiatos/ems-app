package kafka

import (
	"context"
	"log/slog"

	"github.com/Prypiatos/ems-app/backend/internal/tools"
	ckafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type ConfluentConsumer struct {
	c *ckafka.Consumer
}

func NewConsumer(topic, groupID string) (*ConfluentConsumer, error) {
	broker := tools.Getenv("KAFKA_BROKER", "localhost:9092")

	c, err := ckafka.NewConsumer(&ckafka.ConfigMap{
		"bootstrap.servers": broker,
		"group.id":          groupID,
		"auto.offset.reset": "latest",
	})
	if err != nil {
		return nil, err
	}

	if err := c.SubscribeTopics([]string{topic}, nil); err != nil {
		if closeErr := c.Close(); closeErr != nil {
			slog.Error("consumer Close error", "error", closeErr)
		}
		return nil, err
	}

	slog.Info("consumer created",
		"topic", topic,
		"group", groupID,
		"broker", broker,
	)

	return &ConfluentConsumer{c: c}, nil
}

func (cc *ConfluentConsumer) Close() error {
	return cc.c.Close()
}

func (cc *ConfluentConsumer) Consume(ctx context.Context) <-chan []byte {
	out := make(chan []byte)
	go func() {
		for {
			select {
			case <-ctx.Done():
				slog.Info("consumer shutting down")
				return
			default:
			}

			ev := cc.c.Poll(100)
			if ev == nil {
				continue
			}

			switch e := ev.(type) {
			case *ckafka.Message:
				out <- e.Value
				slog.Info("message consumed",
					"topic", e.TopicPartition.Topic,
					"partition", e.TopicPartition.Partition,
					"offset", e.TopicPartition.Offset,
				)
			case ckafka.Error:
				slog.Error("consumer error",
					"code", e.Code,
					"message", e.Error,
				)
			}
		}
	}()
	return out

}
