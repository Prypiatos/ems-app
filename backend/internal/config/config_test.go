package config

import (
	"testing"
	"time"
)

func TestLoadUsesEnvOverrides(t *testing.T) {
	t.Setenv("SERVER_ADDR", "127.0.0.1:9000")
	t.Setenv("HUB_BUFFER_SIZE", "64")
	t.Setenv("CLIENT_BUFFER_SIZE", "32")
	t.Setenv("HUB_PUBLISH_TIMEOUT_MS", "7")
	t.Setenv("CLIENT_WRITE_DEADLINE_MS", "11")
	t.Setenv("CLIENT_READ_DEADLINE_MS", "13")
	t.Setenv("CLIENT_PING_INTERVAL_MS", "17")

	cfg := Load()

	if cfg.ServerAddr != "127.0.0.1:9000" {
		t.Fatalf("ServerAddr = %q, want %q", cfg.ServerAddr, "127.0.0.1:9000")
	}
	if cfg.HubBufferSize != 64 {
		t.Fatalf("HubBufferSize = %d, want %d", cfg.HubBufferSize, 64)
	}
	if cfg.ClientBufferSize != 32 {
		t.Fatalf("ClientBufferSize = %d, want %d", cfg.ClientBufferSize, 32)
	}
	if cfg.PublishTimeout != 7*time.Millisecond {
		t.Fatalf("PublishTimeout = %s, want %s", cfg.PublishTimeout, 7*time.Millisecond)
	}
	if cfg.ClientWriteDeadline != 11*time.Millisecond {
		t.Fatalf("ClientWriteDeadline = %s, want %s", cfg.ClientWriteDeadline, 11*time.Millisecond)
	}
	if cfg.ClientReadDeadline != 13*time.Millisecond {
		t.Fatalf("ClientReadDeadline = %s, want %s", cfg.ClientReadDeadline, 13*time.Millisecond)
	}
	if cfg.ClientPingInterval != 17*time.Millisecond {
		t.Fatalf("ClientPingInterval = %s, want %s", cfg.ClientPingInterval, 17*time.Millisecond)
	}
}

func TestGetEnvIntFallsBackOnBadInput(t *testing.T) {
	t.Setenv("HUB_BUFFER_SIZE", "bad")
	if got := getEnvInt("HUB_BUFFER_SIZE", 48); got != 48 {
		t.Fatalf("getEnvInt = %d, want %d", got, 48)
	}

	t.Setenv("HUB_BUFFER_SIZE", "0")
	if got := getEnvInt("HUB_BUFFER_SIZE", 48); got != 48 {
		t.Fatalf("getEnvInt = %d, want %d", got, 48)
	}
}
