package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all environment-driven configuration for the application.
type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	JWTExpiryHours int
	EmailProvider  string
	SMTPHost       string
	SMTPPort       int
	SMTPUser       string
	SMTPPassword   string
	SMTPFrom       string
	ResendAPIKey   string
	ResendFrom     string
	SendGridAPIKey string
	SendGridFrom   string
	AppName        string
	FrontendURL    string
	AdminEmail     string
	AdminPassword  string
	GeminiAPIKey   string
}

// Load reads .env then environment variables.
// It looks for .env next to the executable first, then in the current directory.
func Load() (*Config, error) {
	// 1. Try loading from the directory where the binary lives (works for compiled runs)
	if exePath, err := os.Executable(); err == nil {
		envPath := filepath.Join(filepath.Dir(exePath), ".env")
		_ = godotenv.Load(envPath)
	}
	// 2. Also try cwd (works for go run)
	_ = godotenv.Load(".env")

	cfg := &Config{}
	cfg.Port = getEnv("PORT", "8080")
	cfg.DatabaseURL = requireEnv("DATABASE_URL")
	cfg.JWTSecret = requireEnv("JWT_SECRET")

	expiryStr := getEnv("JWT_EXPIRY_HOURS", "72")
	expiry, err := strconv.Atoi(expiryStr)
	if err != nil {
		return nil, fmt.Errorf("JWT_EXPIRY_HOURS must be an integer, got %q", expiryStr)
	}
	cfg.JWTExpiryHours = expiry

	cfg.EmailProvider = getEnv("EMAIL_PROVIDER", "smtp")

	switch cfg.EmailProvider {
	case "smtp":
		cfg.SMTPHost = requireEnv("SMTP_HOST")
		cfg.SMTPUser = requireEnv("SMTP_USER")
		cfg.SMTPPassword = requireEnv("SMTP_PASSWORD")
		cfg.SMTPFrom = getEnv("SMTP_FROM", cfg.SMTPUser)
		portStr := getEnv("SMTP_PORT", "587")
		cfg.SMTPPort, err = strconv.Atoi(portStr)
		if err != nil {
			return nil, fmt.Errorf("SMTP_PORT must be an integer, got %q", portStr)
		}
	case "resend":
		cfg.ResendAPIKey = requireEnv("RESEND_API_KEY")
		cfg.ResendFrom = requireEnv("RESEND_FROM")
	case "sendgrid":
		cfg.SendGridAPIKey = requireEnv("SENDGRID_API_KEY")
		cfg.SendGridFrom = requireEnv("SENDGRID_FROM")
	default:
		return nil, fmt.Errorf("EMAIL_PROVIDER must be smtp, resend, or sendgrid; got %q", cfg.EmailProvider)
	}

	cfg.AppName = getEnv("APP_NAME", "SkillO")
	cfg.FrontendURL = getEnv("FRONTEND_URL", "http://localhost:3000")
	cfg.AdminEmail = getEnv("ADMIN_EMAIL", "admin@skillo.app")
	cfg.AdminPassword = getEnv("ADMIN_PASSWORD", "Admin@Skillo123")
	cfg.GeminiAPIKey = getEnv("GEMINI_API_KEY", "")

	return cfg, nil
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required environment variable %q is not set", key))
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
