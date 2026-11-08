package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/skillo/backend/config"
	"github.com/skillo/backend/db"
	"github.com/skillo/backend/handlers"
	"github.com/skillo/backend/mailer"
	"github.com/skillo/backend/models"
	"github.com/skillo/backend/router"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("notice: .env file not loaded: %v", err)
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()
	log.Println("✓ Connected to PostgreSQL")

	userRepo := models.NewUserRepo(pool)

	// Ensure the schema allows the 'admin' role and seed the fixed admin account.
	if err := userRepo.EnsureAdminRoleAllowed(context.Background()); err != nil {
		log.Printf("admin schema: %v", err)
	}
	if err := userRepo.EnsureAdmin(context.Background(), cfg.AdminEmail, cfg.AdminPassword, "Platform", "Admin"); err != nil {
		log.Printf("admin seed: %v", err)
	} else {
		log.Printf("✓ Admin account ensured (%s)", cfg.AdminEmail)
	}

	jobRepo := models.NewJobRepo(pool)
	if err := jobRepo.EnsureJobsTable(context.Background()); err != nil {
		log.Printf("jobs schema: %v", err)
	} else {
		log.Println("✓ Jobs table ready")
	}

	submissionRepo := models.NewSubmissionRepo(pool)
	if err := submissionRepo.EnsureSubmissionsTable(context.Background()); err != nil {
		log.Printf("submissions schema: %v", err)
	} else {
		log.Println("✓ Submissions table ready")
	}

	mailClient := mailer.New(cfg)
	authHandler := handlers.NewAuthHandler(cfg, userRepo, mailClient)
	adminHandler := handlers.NewAdminHandler(userRepo)
	jobHandler := handlers.NewJobHandler(jobRepo, userRepo)
	submissionHandler := handlers.NewSubmissionHandler(submissionRepo, jobRepo, userRepo)
	uploadHandler := &handlers.UploadHandler{}

	handler := router.New(cfg, authHandler, adminHandler, jobHandler, submissionHandler, uploadHandler)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("✓ SkillO API listening on http://localhost:%s", cfg.Port)
		log.Printf("  Email provider : %s", cfg.EmailProvider)
		log.Printf("  Frontend origin: %s", cfg.FrontendURL)
		if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		log.Fatalf("server error: %v", err)
	case sig := <-quit:
		log.Printf("received %s — shutting down gracefully...", sig)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown failed: %v", err)
	}
	log.Println("server stopped")
}
