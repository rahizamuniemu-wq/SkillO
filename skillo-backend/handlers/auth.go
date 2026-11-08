package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/skillo/backend/config"
	"github.com/skillo/backend/mailer"
	"github.com/skillo/backend/middleware"
	"github.com/skillo/backend/models"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	cfg    *config.Config
	repo   *models.UserRepo
	mailer *mailer.Mailer
}

func NewAuthHandler(cfg *config.Config, repo *models.UserRepo, m *mailer.Mailer) *AuthHandler {
	return &AuthHandler{cfg: cfg, repo: repo, mailer: m}
}

// parseJWT validates a token string and returns its claims.
func parseJWT(tokenStr, secret string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}
	return claims, nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func generate6DigitCode() string {
	return fmt.Sprintf("%06d", rand.Intn(1_000_000))
}

func (h *AuthHandler) issueJWT(userID, role string) (string, error) {
	claims := jwt.MapClaims{
		"sub":  userID,
		"role": role,
		"exp":  time.Now().Add(time.Duration(h.cfg.JWTExpiryHours) * time.Hour).Unix(),
		"iat":  time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	University  string `json:"university,omitempty"`
	Batch       string `json:"batch,omitempty"`
	Department  string `json:"department,omitempty"`
	Skills      string `json:"skills,omitempty"`
	CompanyName string `json:"companyName,omitempty"`
	Industry    string `json:"industry,omitempty"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		writeError(w, http.StatusBadRequest, "email, password, firstName and lastName are required")
		return
	}
	if req.Role != "worker" && req.Role != "company" {
		writeError(w, http.StatusBadRequest, "role must be 'worker' or 'company'")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	existing, err := h.repo.FindByEmail(ctx, req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if existing != nil {
		writeError(w, http.StatusConflict, "an account with this email already exists")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	code := generate6DigitCode()
	codeExp := time.Now().Add(15 * time.Minute)

	user := &models.User{
		Email:         req.Email,
		PasswordHash:  string(hash),
		Role:          req.Role,
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		VerifyCode:    &code,
		VerifyCodeExp: &codeExp,
	}
	if req.University != "" {
		user.University = &req.University
	}
	if req.Batch != "" {
		user.Batch = &req.Batch
	}
	if req.Department != "" {
		user.Department = &req.Department
	}
	if req.Skills != "" {
		user.Skills = &req.Skills
	}
	if req.CompanyName != "" {
		user.CompanyName = &req.CompanyName
	}
	if req.Industry != "" {
		user.Industry = &req.Industry
	}

	created, err := h.repo.Create(ctx, user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	if err := h.mailer.SendVerificationCode(created.Email, created.FirstName, code); err != nil {
		fmt.Printf("[mailer] SendVerificationCode error: %v\n", err)
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"message": "Account created. Check your email for the 6-digit verification code.",
		"email":   created.Email,
	})
}

// ── POST /api/auth/verify ─────────────────────────────────────────────────────

type verifyRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func (h *AuthHandler) Verify(w http.ResponseWriter, r *http.Request) {
	var req verifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Code == "" {
		writeError(w, http.StatusBadRequest, "email and code are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := h.repo.FindByEmail(ctx, req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "no account found with this email")
		return
	}
	if user.IsVerified {
		writeError(w, http.StatusConflict, "account is already verified")
		return
	}
	if user.VerifyCode == nil || *user.VerifyCode != req.Code {
		writeError(w, http.StatusUnauthorized, "invalid verification code")
		return
	}
	if user.VerifyCodeExp == nil || time.Now().After(*user.VerifyCodeExp) {
		writeError(w, http.StatusUnauthorized, "verification code has expired — please request a new one")
		return
	}

	if err := h.repo.MarkVerified(ctx, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify account")
		return
	}

	token, err := h.issueJWT(user.ID, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Email verified successfully. Welcome to SkillO!",
		"token":   token,
		"user": map[string]any{
			"id": user.ID, "email": user.Email, "role": user.Role,
			"firstName": user.FirstName, "lastName": user.LastName,
			"companyName": user.CompanyName, "industry": user.Industry,
			"university": user.University, "batch": user.Batch,
			"department": user.Department, "skills": user.Skills,
			"points": user.Points,
		},
	})
}

// ── POST /api/auth/resend-code ────────────────────────────────────────────────

type resendRequest struct {
	Email string `json:"email"`
}

func (h *AuthHandler) ResendCode(w http.ResponseWriter, r *http.Request) {
	var req resendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := h.repo.FindByEmail(ctx, req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "no account found with this email")
		return
	}
	if user.IsVerified {
		writeError(w, http.StatusConflict, "account is already verified")
		return
	}

	code := generate6DigitCode()
	codeExp := time.Now().Add(15 * time.Minute)

	if err := h.repo.UpdateVerifyCode(ctx, user.ID, code, codeExp); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update code")
		return
	}
	if err := h.mailer.SendVerificationCode(user.Email, user.FirstName, code); err != nil {
		fmt.Printf("[mailer] ResendCode error: %v\n", err)
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "A new verification code has been sent to your email.",
	})
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := h.repo.FindByEmail(ctx, req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if user == nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if req.Role != "" && req.Role != "admin" && user.Role != req.Role {
		writeError(w, http.StatusUnauthorized, "no account found with this email for the selected role")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if user.Role != "admin" && !user.IsVerified {
		writeError(w, http.StatusForbidden, "please verify your email before signing in")
		return
	}

	token, err := h.issueJWT(user.ID, user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to issue token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user": map[string]any{
			"id": user.ID, "email": user.Email, "role": user.Role,
			"firstName": user.FirstName, "lastName": user.LastName,
			"companyName": user.CompanyName, "industry": user.Industry,
			"university": user.University, "batch": user.Batch,
			"department": user.Department, "skills": user.Skills,
			"points": user.Points,
		},
	})
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := h.repo.FindByID(ctx, userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"id": user.ID, "email": user.Email, "role": user.Role,
		"firstName": user.FirstName, "lastName": user.LastName,
		"companyName": user.CompanyName, "industry": user.Industry,
		"university": user.University, "batch": user.Batch,
		"department": user.Department, "skills": user.Skills,
		"points": user.Points, "isVerified": user.IsVerified,
	})
}

func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req map[string]any
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	allowed := map[string]bool{"firstName": true, "lastName": true, "university": true, "batch": true, "department": true, "skills": true, "companyName": true, "industry": true, "website": true, "description": true}
	fields := make(map[string]any)
	for key, value := range req {
		if !allowed[key] {
			continue
		}
		if value == nil {
			fields[key] = nil
			continue
		}
		text, ok := value.(string)
		if !ok {
			writeError(w, http.StatusBadRequest, key+" must be a string")
			return
		}
		fields[key] = text
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	user, err := h.repo.UpdateProfile(ctx, userID, fields)
	if err != nil || user == nil {
		writeError(w, http.StatusInternalServerError, "failed to save profile")
		return
	}
	writeJSON(w, http.StatusOK, userResponse(user))
}

func userResponse(user *models.User) map[string]any {
	return map[string]any{
		"id": user.ID, "email": user.Email, "role": user.Role,
		"firstName": user.FirstName, "lastName": user.LastName,
		"companyName": user.CompanyName, "industry": user.Industry,
		"university": user.University, "batch": user.Batch,
		"department": user.Department, "skills": user.Skills,
		"website": user.Website, "description": user.Description,
		"points": user.Points, "isVerified": user.IsVerified,
	}
}

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Step 1: user submits their email; we send a 6-digit reset code via SMTP.

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := h.repo.FindByEmail(ctx, req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	// Always return a generic success message to prevent user enumeration.
	if user == nil {
		writeJSON(w, http.StatusOK, map[string]string{
			"message": "If that email is registered, a reset code has been sent.",
		})
		return
	}

	code := generate6DigitCode()
	codeExp := time.Now().Add(15 * time.Minute)

	if err := h.repo.SetResetCode(ctx, user.ID, code, codeExp); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set reset code")
		return
	}
	if err := h.mailer.SendPasswordResetCode(user.Email, user.FirstName, code); err != nil {
		fmt.Printf("[mailer] ForgotPassword error: %v\n", err)
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "If that email is registered, a reset code has been sent.",
		"email":   user.Email,
	})
}

// ── POST /api/auth/verify-reset-code ─────────────────────────────────────────
// Step 2: user enters the 6-digit code; returns a short-lived reset token.

func (h *AuthHandler) VerifyResetCode(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Code == "" {
		writeError(w, http.StatusBadRequest, "email and code are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	user, err := h.repo.FindByEmail(ctx, req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "no account found with this email")
		return
	}
	if user.VerifyCode == nil || *user.VerifyCode != req.Code {
		writeError(w, http.StatusUnauthorized, "invalid or incorrect reset code")
		return
	}
	if user.VerifyCodeExp == nil || time.Now().After(*user.VerifyCodeExp) {
		writeError(w, http.StatusUnauthorized, "reset code has expired — please request a new one")
		return
	}

	// Issue a short-lived JWT scoped to password reset only (role prefixed with "reset:").
	token, err := h.issueJWT(user.ID, "reset:"+user.Role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to issue reset token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message":    "Code verified. You may now set a new password.",
		"resetToken": token,
	})
}

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Step 3: user submits the reset token + new password; we update the hash.

func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ResetToken  string `json:"resetToken"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ResetToken == "" || req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "resetToken and newPassword are required")
		return
	}
	if len(req.NewPassword) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	claims, err := parseJWT(req.ResetToken, h.cfg.JWTSecret)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired reset token")
		return
	}
	role, _ := claims["role"].(string)
	if len(role) < 6 || role[:6] != "reset:" {
		writeError(w, http.StatusForbidden, "this token cannot be used for password reset")
		return
	}
	userID, _ := claims["sub"].(string)
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "invalid reset token")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}
	if err := h.repo.ResetPassword(ctx, userID, string(hash)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Password updated successfully. You can now sign in with your new password.",
	})
}
