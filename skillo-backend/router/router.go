package router

import (
	"net/http"

	"github.com/rs/cors"
	"github.com/skillo/backend/config"
	"github.com/skillo/backend/handlers"
	"github.com/skillo/backend/middleware"
)

func New(cfg *config.Config, auth *handlers.AuthHandler, admin *handlers.AdminHandler, job *handlers.JobHandler, sub *handlers.SubmissionHandler, upload *handlers.UploadHandler) http.Handler {
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Auth — public
	mux.HandleFunc("POST /api/auth/register", auth.Register)
	mux.HandleFunc("POST /api/auth/login", auth.Login)
	mux.HandleFunc("POST /api/auth/verify", auth.Verify)
	mux.HandleFunc("POST /api/auth/resend-code", auth.ResendCode)
	mux.HandleFunc("POST /api/auth/forgot-password", auth.ForgotPassword)
	mux.HandleFunc("POST /api/auth/verify-reset-code", auth.VerifyResetCode)
	mux.HandleFunc("POST /api/auth/reset-password", auth.ResetPassword)

	// Auth — protected
	protected := middleware.RequireAuth(cfg)
	mux.Handle("GET /api/auth/me", protected(http.HandlerFunc(auth.Me)))
	mux.Handle("PATCH /api/auth/profile", protected(http.HandlerFunc(auth.UpdateProfile)))
	mux.Handle("POST /api/uploads", protected(http.HandlerFunc(upload.Create)))
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))))

	// Admin — protected (JWT + admin role enforced inside handler)
	mux.Handle("GET /api/admin/stats", protected(http.HandlerFunc(admin.Stats)))
	mux.Handle("GET /api/admin/users", protected(http.HandlerFunc(admin.Users)))

	// Jobs — protected. Companies create/edit/delete; everyone can browse.
	mux.Handle("POST /api/jobs", protected(http.HandlerFunc(job.Create)))
	mux.Handle("POST /api/jobs/suggestions", protected(http.HandlerFunc(job.Suggest)))
	mux.Handle("POST /api/jobs/{id}/book", protected(http.HandlerFunc(job.Book)))
	mux.Handle("GET /api/jobs/booked", protected(http.HandlerFunc(job.Booked)))
	mux.Handle("GET /api/jobs", protected(http.HandlerFunc(job.List)))
	mux.Handle("PATCH /api/jobs/{id}", protected(http.HandlerFunc(job.Patch)))
	mux.Handle("DELETE /api/jobs/{id}", protected(http.HandlerFunc(job.Delete)))

	// Submissions — protected. Workers submit; companies review + distribute.
	mux.Handle("POST /api/submissions", protected(http.HandlerFunc(sub.Create)))
	mux.Handle("GET /api/submissions", protected(http.HandlerFunc(sub.List)))
	mux.Handle("GET /api/submissions/mine", protected(http.HandlerFunc(sub.Mine)))
	mux.Handle("PATCH /api/submissions/{id}", protected(http.HandlerFunc(sub.Review)))
	mux.Handle("POST /api/jobs/{id}/distribute", protected(http.HandlerFunc(sub.Distribute)))

	// CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendURL, "http://localhost:3000", "http://localhost:5173"},
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		AllowCredentials: true,
		MaxAge:           300,
	})

	return c.Handler(mux)
}
