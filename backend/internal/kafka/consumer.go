package kafka

import (
	"context"
	"errors"
	"log/slog"
)

type Consumer interface {
	Close() error
	Poll(timeoutMs int) any
}

var ErrNoBrokersAvailable = errors.New("no Kafka Brokers available")

func Consume(ctx context.Context, c Consumer) {
	for {
		select {
		case <-ctx.Done():
			slog.Info("consumer shutting down")
			return
		default:
		}

		ev := c.Poll(100)
		if ev == nil {
			continue
		}

		switch e := ev.(type) {
		case Message:
			slog.Info("message consumed",
				"topic", e.Topic,
				"partition", e.Partition,
				"offset", e.Offset,
			)
		case Error:
			slog.Error("consumer error",
				"code", e.Code,
				"message", e.Msg,
			)
		}
	}
}
