package ws

import (
	"context"
	"testing"
	"time"
)

func TestNewHubInitializesTopicState(t *testing.T) {
	hub := NewHub([]string{"energy.readings", "energy.anomalies"}, 8)

	if len(hub.Buffer) != 2 {
		t.Fatalf("buffer topics = %d, want %d", len(hub.Buffer), 2)
	}
	if cap(hub.Buffer["energy.readings"]) != 8 {
		t.Fatalf("buffer cap = %d, want %d", cap(hub.Buffer["energy.readings"]), 8)
	}
	if hub.TopicLocks["energy.readings"] == nil {
		t.Fatal("topic lock missing")
	}
}

func TestPublishQueuesMessageAndDropsUnknownTopic(t *testing.T) {
	hub := NewHub([]string{"energy.readings"}, 1)
	msg := []byte("payload")

	if !hub.Publish(context.Background(), "energy.readings", msg, 0) {
		t.Fatal("publish returned false for open buffer")
	}
	if got := <-hub.Buffer["energy.readings"]; string(got) != "payload" {
		t.Fatalf("buffer payload = %q, want %q", got, msg)
	}
	if hub.Publish(context.Background(), "missing", msg, 0) {
		t.Fatal("publish returned true for unknown topic")
	}

	if !hub.Publish(context.Background(), "energy.readings", msg, 0) {
		t.Fatal("second publish returned false with empty buffer")
	}
	if hub.Publish(context.Background(), "energy.readings", msg, 0) {
		t.Fatal("publish returned true for full buffer")
	}
}

func TestPublishHonorsContextCancel(t *testing.T) {
	hub := NewHub([]string{"energy.readings"}, 1)
	if !hub.Publish(context.Background(), "energy.readings", []byte("warmup"), 0) {
		t.Fatal("warmup publish failed")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if hub.Publish(ctx, "energy.readings", []byte("x"), time.Second) {
		t.Fatal("publish returned true after context cancel")
	}
	if got := <-hub.Buffer["energy.readings"]; string(got) != "warmup" {
		t.Fatalf("warmup payload = %q, want %q", got, "warmup")
	}
}
