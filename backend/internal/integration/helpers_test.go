//go:build integration
// +build integration

package integration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/app"
	"github.com/Prypiatos/ems-app/backend/internal/config"
	skafka "github.com/segmentio/kafka-go"
)

const (
	defaultKafkaBroker = "localhost:9092"
	startupTimeout     = 10 * time.Second
	pollInterval       = 150 * time.Millisecond
)

func TestMain(m *testing.M) {
	broker := kafkaBroker()
	if err := waitForBroker(broker, startupTimeout); err != nil {
		fmt.Fprintf(os.Stderr, "kafka broker not reachable at %s: %v\n", broker, err)
		os.Exit(1)
	}

	os.Exit(m.Run())
}

func kafkaBroker() string {
	if broker := os.Getenv("KAFKA_BROKER"); broker != "" {
		return broker
	}
	return defaultKafkaBroker
}

func waitForBroker(broker string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", broker, 300*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		lastErr = err
		time.Sleep(200 * time.Millisecond)
	}
	if lastErr == nil {
		lastErr = errors.New("timeout waiting for broker")
	}
	return lastErr
}

func reserveAddr(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}
	return addr
}

func startRuntime(t *testing.T) (string, func()) {
	t.Helper()
	addr := reserveAddr(t)

	cfg := config.Config{
		ServerAddr:           addr,
		Topics:               []string{"telemetry"},
		TopicGroups:          map[string]string{},
		TelemetryTopic:       "telemetry",
		EnableTopicDiscovery: true,
		HubBufferSize:        64,
		ClientBufferSize:     16,
		PublishTimeout:       2 * time.Second,
		ClientWriteDeadline:  2 * time.Second,
		ClientReadDeadline:   5 * time.Second,
		ClientPingInterval:   2 * time.Second,
	}

	ctx, cancel := context.WithCancel(context.Background())
	rt := app.New(cfg)
	done := make(chan error, 1)
	go func() { done <- rt.Run(ctx, cancel) }()

	baseURL := "http://" + addr
	waitForHTTP(t, baseURL+"/api/v1/health", startupTimeout)

	stop := func() {
		cancel()
		waitForShutdown(t, done)
	}

	return baseURL, stop
}

func waitForHTTP(t *testing.T, url string, timeout time.Duration) {
	t.Helper()
	client := &http.Client{Timeout: 500 * time.Millisecond}
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		resp, err := client.Get(url)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
			lastErr = fmt.Errorf("status %d", resp.StatusCode)
		} else {
			lastErr = err
		}
		time.Sleep(pollInterval)
	}
	if lastErr != nil {
		t.Fatalf("health endpoint not ready: %v", lastErr)
	}
	t.Fatalf("health endpoint not ready")
}

func waitForShutdown(t *testing.T, done <-chan error) {
	t.Helper()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("runtime stopped with error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("runtime did not stop")
	}
}

func waitForCondition(t *testing.T, timeout time.Duration, fn func() (bool, error)) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		ok, err := fn()
		if err == nil && ok {
			return
		}
		lastErr = err
		time.Sleep(pollInterval)
	}
	if lastErr != nil {
		t.Fatalf("condition not met: %v", lastErr)
	}
	t.Fatal("condition not met")
}

func httpGetJSON(url string, target any) error {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(target)
}

func createKafkaTopic(t *testing.T, broker, topic string) {
	t.Helper()
	conn, err := skafka.Dial("tcp", broker)
	if err != nil {
		t.Fatalf("dial broker: %v", err)
	}
	defer conn.Close()

	err = conn.CreateTopics(skafka.TopicConfig{
		Topic:             topic,
		NumPartitions:     1,
		ReplicationFactor: 1,
	})
	if err != nil && !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("create topic %s: %v", topic, err)
	}
}

func writeKafkaMessage(t *testing.T, broker, topic string, payload []byte) {
	t.Helper()
	writer := &skafka.Writer{
		Addr:     skafka.TCP(broker),
		Topic:    topic,
		Balancer: &skafka.LeastBytes{},
	}
	defer writer.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := writer.WriteMessages(ctx, skafka.Message{Value: payload}); err != nil {
		t.Fatalf("write kafka message: %v", err)
	}
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json marshal: %v", err)
	}
	return data
}

func newNodeID() string {
	return fmt.Sprintf("node_%d", time.Now().UnixNano())
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
