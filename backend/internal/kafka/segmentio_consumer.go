package kafka

import (
	"context"
	"errors"
	"log/slog"
	"sort"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/utils"
	skafka "github.com/segmentio/kafka-go"
)

type kafkaReader interface {
	Close() error
	ReadMessage(ctx context.Context) (skafka.Message, error)
}

func ListTopics(ctx context.Context) ([]string, error) {
	broker := utils.Getenv("KAFKA_BROKER", "localhost:9092")
	connCtx, cancel := context.WithTimeout(ctx, connectionTimeout)
	defer cancel()

	conn, err := newKafkaConn(connCtx, "tcp", broker)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	typedConn, ok := conn.(*skafka.Conn)
	if !ok {
		return nil, errors.New("unexpected kafka connector type")
	}

	partitions, err := typedConn.ReadPartitions()
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{})
	for _, p := range partitions {
		seen[p.Topic] = struct{}{}
	}

	topics := make([]string, 0, len(seen))
	for t := range seen {
		topics = append(topics, t)
	}
	sort.Strings(topics)
	return topics, nil
}

type kafkaConnector interface {
	Close() error
}

type SegmentioConsumer struct {
	r kafkaReader
}

var newKafkaReader = func(cfg skafka.ReaderConfig) (kafkaReader, error) {
	return skafka.NewReader(cfg), nil
}

var newKafkaConn = func(ctx context.Context, network, address string) (kafkaConnector, error) {
	dialer := &skafka.Dialer{Timeout: connectionTimeout}
	return dialer.DialContext(ctx, network, address)
}

const (
	BufferSize               = 256
	connectionTimeout        = 1 * time.Second
	initialConnectionBackoff = 250 * time.Millisecond
	maxConnectionBackoff     = 5 * time.Second
	readErrorBackoff         = 250 * time.Millisecond
)

func NewConsumer(ctx context.Context, topic, groupID string) (*SegmentioConsumer, error) {
	broker := utils.Getenv("KAFKA_BROKER", "localhost:9092")
	backoff := initialConnectionBackoff

	for attempt := 1; ; attempt++ {
		if err := waitForBroker(ctx, broker); err != nil {
			if err := waitForRetry(ctx, backoff); err != nil {
				return nil, err
			}
			backoff = nextBackoff(backoff)
			continue
		}

		reader, err := newKafkaReader(skafka.ReaderConfig{
			Brokers: []string{broker},
			Topic:   topic,
			GroupID: groupID,
		})
		if err != nil {
			if err := waitForRetry(ctx, backoff); err != nil {
				return nil, err
			}
			backoff = nextBackoff(backoff)
			continue
		}

		slog.Info("consumer created",
			"topic", topic,
			"group", groupID,
			"broker", broker,
			"attempt", attempt,
		)

		return &SegmentioConsumer{r: reader}, nil
	}
}

func waitForBroker(ctx context.Context, broker string) error {
	connCtx, cancel := context.WithTimeout(ctx, connectionTimeout)
	defer cancel()

	conn, err := newKafkaConn(connCtx, "tcp", broker)
	if err != nil {
		return err
	}
	if closeErr := conn.Close(); closeErr != nil {
		return closeErr
	}
	return nil
}

var waitForRetry = func(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func nextBackoff(current time.Duration) time.Duration {
	next := current * 2
	if next > maxConnectionBackoff {
		return maxConnectionBackoff
	}
	return next
}

func (sc *SegmentioConsumer) Close() error {
	return sc.r.Close()
}

func (sc *SegmentioConsumer) Consume(ctx context.Context) <-chan Record {
	out := make(chan Record, BufferSize)
	go func() {
		defer close(out)
		for {
			msg, err := sc.r.ReadMessage(ctx)
			if err != nil {
				if ctx.Err() != nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					slog.Info("consumer shutting down")
					return
				}
				slog.Error("consumer error", "error", err)
				if err := waitForRetry(ctx, readErrorBackoff); err != nil {
					return
				}
				continue
			}

			record := Record{Topic: msg.Topic, Value: msg.Value}
			select {
			case out <- record:
			default:
				select {
				case <-out:
				default:
				}
				out <- record
			}
			slog.Info("message consumed", "topic", msg.Topic, "partition", msg.Partition, "offset", msg.Offset)
		}
	}()
	return out
}
