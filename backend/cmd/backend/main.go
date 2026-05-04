package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/Prypiatos/ems-app/backend/internal/app"
	"github.com/Prypiatos/ems-app/backend/internal/config"
	"github.com/joho/godotenv"
)

func main() {

	// setup slog
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// app context with signal handlers
	appCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// load environment variables
	if err := godotenv.Load(); err != nil {
		slog.Warn("failed to load env file", slog.String("error", err.Error()))
	}

	cfg := config.Load()
	runtime := app.New(cfg)
	if err := runtime.Run(appCtx, stop); err != nil {
		slog.Error("runtime failed", "error", err)
	}
}
