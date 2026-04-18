package tools

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

func WithSignalCancel() (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())

	go func() {
		ch := make(chan os.Signal, 1)
		signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
		select {
		case <-ch:
			slog.Info("signal received, cancelling context")
			cancel()
		case <-ctx.Done():
		}

	}()

	return ctx, cancel
}

func Getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
