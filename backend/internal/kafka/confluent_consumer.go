package kafka

import (
	"log/slog"

	"github.com/Prypiatos/ems-app/backend/internal/tools"
	ckafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

type confluentConsumer struct {
	c *ckafka.Consumer
}

func NewConsumer(topic, groupID string) (Consumer, error) {
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

	return &confluentConsumer{c: c}, nil
}

func (cc *confluentConsumer) Close() error {
	return cc.c.Close()
}

func (cc *confluentConsumer) Poll(timeoutMs int) any {
	ev := cc.c.Poll(timeoutMs)
	if ev == nil {
		return nil
	}

	switch e := ev.(type) {
	case *ckafka.Message:
		return Message{
			Topic:     *e.TopicPartition.Topic,
			Partition: e.TopicPartition.Partition,
			Offset:    int64(e.TopicPartition.Offset),
		}
	case *ckafka.Error:
		return Error{
			Code: int(e.Code()),
			Msg:  e.Error(),
		}
	default:
		return nil
	}
}

func (cc *confluentConsumer) CheckHealth() error {
	broker := tools.Getenv("KAFKA_BROKER", "localhost:9092")
	config := &ckafka.ConfigMap{
		"bootstrap.servers": broker,
		"socket.timeout.ms": 2000,
	}
	admin, err := ckafka.NewAdminClient(config)

	if err != nil {
		slog.Error("Failed to create admin client", "error", err)
		return err
	}
	defer admin.Close()

	// Try to fetch cluster metadata
	md, err := admin.GetMetadata(nil, false, 2000)
	if err != nil {
		slog.Error("Broker not reachable", "error", err)
		return err
	}

	if len(md.Brokers) == 0 {
		slog.Error("No brokers available", "error", ErrNoBrokersAvailable)
	}

	slog.Info("Kafka is reachable")

	return nil
}
