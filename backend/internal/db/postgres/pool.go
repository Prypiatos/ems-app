package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultMaxConns     = int32(20)
	defaultMinConns     = int32(5)
	defaultMaxLifetime  = time.Hour
	defaultPingDeadline = 5 * time.Second
)

func NewPool(ctx context.Context, connectionString string) (*pgxpool.Pool, error) {
	if strings.TrimSpace(connectionString) == "" {
		return nil, errors.New("postgres connection string is required")
	}

	config, err := pgxpool.ParseConfig(connectionString)
	if err != nil {
		return nil, fmt.Errorf("parse postgres connection string: %w", err)
	}

	config.MaxConns = defaultMaxConns
	config.MinConns = defaultMinConns
	config.MaxConnLifetime = defaultMaxLifetime

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, defaultPingDeadline)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return pool, nil
}
