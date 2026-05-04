package config

import (
	"strconv"
	"time"

	"github.com/Prypiatos/ems-app/backend/internal/utils"
)

type Config struct {
	ServerAddr          string
	Topics              []string
	TopicGroups         map[string]string
	HubBufferSize       int
	ClientBufferSize    int
	PublishTimeout      time.Duration
	ClientWriteDeadline time.Duration
	ClientReadDeadline  time.Duration
	ClientPingInterval  time.Duration
}

func Load() Config {
	return Config{
		ServerAddr: utils.Getenv("SERVER_ADDR", ":8080"),
		Topics: []string{
			"energy.readings",
			"energy.anomalies",
			"energy.forecasts",
		},
		TopicGroups: map[string]string{
			"energy.readings":  "energy-readings",
			"energy.anomalies": "energy-anomalies",
			"energy.forecasts": "energy-forecasts",
		},
		HubBufferSize:       getEnvInt("HUB_BUFFER_SIZE", 256),
		ClientBufferSize:    getEnvInt("CLIENT_BUFFER_SIZE", 256),
		PublishTimeout:      getEnvDurationMs("HUB_PUBLISH_TIMEOUT_MS", 25),
		ClientWriteDeadline: getEnvDurationMs("CLIENT_WRITE_DEADLINE_MS", 500),
		ClientReadDeadline:  getEnvDurationMs("CLIENT_READ_DEADLINE_MS", 60000),
		ClientPingInterval:  getEnvDurationMs("CLIENT_PING_INTERVAL_MS", 30000),
	}
}

func getEnvInt(key string, fallback int) int {
	v := utils.Getenv(key, "")
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func getEnvDurationMs(key string, fallbackMs int) time.Duration {
	ms := getEnvInt(key, fallbackMs)
	return time.Duration(ms) * time.Millisecond
}
