package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool is the shared connection pool used by the entire application.
// Handlers receive it via dependency injection (stored on the handler struct).
var Pool *pgxpool.Pool

// Connect opens a connection pool to the Supabase PostgreSQL instance and
// verifies connectivity with a ping. It returns an error instead of panicking
// so main() can decide how to handle it.
func Connect(databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: parse config: %w", err)
	}

	// Sensible pool defaults for a small-to-medium Supabase project.
	// Supabase free tier allows ~20 connections; stay well below that.
	cfg.MaxConns          = 10
	cfg.MinConns          = 2
	cfg.MaxConnLifetime   = 30 * time.Minute
	cfg.MaxConnIdleTime   = 5 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: create pool: %w", err)
	}

	// Verify the connection is alive
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping failed: %w", err)
	}

	Pool = pool
	return pool, nil
}

// Close gracefully shuts down the connection pool.
// Call this with defer in main() after Connect succeeds.
func Close() {
	if Pool != nil {
		Pool.Close()
	}
}
