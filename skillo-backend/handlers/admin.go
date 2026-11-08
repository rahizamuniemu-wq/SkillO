package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/skillo/backend/middleware"
	"github.com/skillo/backend/models"
)

type AdminHandler struct {
	repo *models.UserRepo
}

func NewAdminHandler(repo *models.UserRepo) *AdminHandler {
	return &AdminHandler{repo: repo}
}

// GET /api/admin/stats — returns platform overview, no sensitive fields
func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	// Only admin role can call this
	if middleware.GetUserRole(r) != "admin" {
		writeError(w, http.StatusForbidden, "admin access required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	stats, err := h.repo.GetPlatformStats(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch stats")
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

// GET /api/admin/users — returns user list without passwords/OTP fields
func (h *AdminHandler) Users(w http.ResponseWriter, r *http.Request) {
	if middleware.GetUserRole(r) != "admin" {
		writeError(w, http.StatusForbidden, "admin access required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	users, err := h.repo.ListUsers(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch users")
		return
	}

	writeJSON(w, http.StatusOK, users)
}
