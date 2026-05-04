package kafka

import (
	"context"
	"errors"
	"testing"
	"time"

	skafka "github.com/segmentio/kafka-go"
)

type fakeKafkaConn struct {
	closed bool
}

func (f *fakeKafkaConn) Close() error {
	f.closed = true
	return nil
}

type fakeKafkaReader struct{}

func (f *fakeKafkaReader) Close() error {
	return nil
}

func (f *fakeKafkaReader) ReadMessage(ctx context.Context) (skafka.Message, error) {
	return skafka.Message{}, context.Canceled
}

func TestNewConsumerRetriesWithExponentialBackoff(t *testing.T) {
	oldNewKafkaReader := newKafkaReader
	oldNewKafkaConn := newKafkaConn
	oldWaitForRetry := waitForRetry
	defer func() {
		newKafkaReader = oldNewKafkaReader
		newKafkaConn = oldNewKafkaConn
		waitForRetry = oldWaitForRetry
	}()

	connAttempts := 0
	var lastConn *fakeKafkaConn
	newKafkaConn = func(ctx context.Context, network, address string) (kafkaConnector, error) {
		connAttempts++
		if connAttempts < 3 {
			return nil, errors.New("broker unavailable")
		}
		lastConn = &fakeKafkaConn{}
		return lastConn, nil
	}

	readerCalls := 0
	newKafkaReader = func(cfg skafka.ReaderConfig) (kafkaReader, error) {
		readerCalls++
		return &fakeKafkaReader{}, nil
	}

	delays := make([]time.Duration, 0, 2)
	waitForRetry = func(ctx context.Context, delay time.Duration) error {
		delays = append(delays, delay)
		return nil
	}

	consumer, err := NewConsumer(context.Background(), "topic", "group")
	if err != nil {
		t.Fatalf("NewConsumer returned error: %v", err)
	}
	if consumer == nil {
		t.Fatal("NewConsumer returned nil consumer")
	}
	if got, want := connAttempts, 3; got != want {
		t.Fatalf("newKafkaConn calls = %d, want %d", got, want)
	}
	if got, want := readerCalls, 1; got != want {
		t.Fatalf("newKafkaReader calls = %d, want %d", got, want)
	}
	if got, want := delays, []time.Duration{250 * time.Millisecond, 500 * time.Millisecond}; len(got) != len(want) {
		t.Fatalf("backoff delays len = %d, want %d", len(got), len(want))
	} else {
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("backoff delay %d = %v, want %v", i, got[i], want[i])
			}
		}
	}
	if lastConn == nil || !lastConn.closed {
		t.Fatal("successful broker connection not closed")
	}
}
