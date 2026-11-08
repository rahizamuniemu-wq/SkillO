// cmd/migrate/main.go
// Run: go run ./cmd/migrate
// Applies db/migrations/001_create_users.sql against DATABASE_URL in .env
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load() // load .env from current directory

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	sql, err := os.ReadFile("db/migrations/001_create_users.sql")
	if err != nil {
		log.Fatalf("read migration: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, string(sql)); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	fmt.Println("✓ Migration applied successfully")
}
