package app

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/config"
	"github.com/Prypiatos/ems-app/backend/internal/kafka"
)

func TestRuntimeRunStopsOnContextCancel(t *testing.T) {
	rt := New(config.Config{
		ServerAddr:          "127.0.0.1:0",
		Topics:              nil,
		TopicGroups:         map[string]string{},
		HubBufferSize:       1,
		ClientBufferSize:    1,
		PublishTimeout:      time.Millisecond,
		ClientWriteDeadline: time.Millisecond,
		ClientReadDeadline:  time.Millisecond,
		ClientPingInterval:  time.Millisecond,
	})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- rt.Run(ctx, cancel)
	}()

	time.AfterFunc(50*time.Millisecond, cancel)

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run returned error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop after context cancel")
	}
}

func TestRuntimeRunServesHTTPWhileKafkaStartupBlocks(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}

	rt := New(config.Config{
		ServerAddr:          addr,
		Topics:              []string{"energy.readings"},
		TopicGroups:         map[string]string{"energy.readings": "energy-readings"},
		HubBufferSize:       1,
		ClientBufferSize:    1,
		PublishTimeout:      time.Millisecond,
		ClientWriteDeadline: time.Millisecond,
		ClientReadDeadline:  time.Millisecond,
		ClientPingInterval:  time.Millisecond,
	})

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	originalFactory := newKafkaConsumer
	newKafkaConsumer = func(ctx context.Context, topic, groupID string) (kafka.Consumer, error) {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	t.Cleanup(func() {
		newKafkaConsumer = originalFactory
	})

	done := make(chan error, 1)
	go func() {
		done <- rt.Run(ctx, cancel)
	}()

	client := &http.Client{Timeout: 100 * time.Millisecond}
	healthURL := "http://" + addr + "/api/v1/health"
	ticker := time.NewTicker(25 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.After(3 * time.Second)

	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
		if err != nil {
			t.Fatalf("new request: %v", err)
		}

		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				cancel()
				break
			}
		}

		select {
		case <-deadline:
			t.Fatal("health endpoint did not respond while Kafka startup was blocked")
		case <-ticker.C:
		}
	}

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run returned error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Run did not stop after cancel")
	}
}
