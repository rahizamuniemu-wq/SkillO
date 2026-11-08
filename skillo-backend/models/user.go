package models

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// ── Domain model ─────────────────────────────────────────────────────────────

type User struct {
	ID            string     `json:"id"`
	Email         string     `json:"email"`
	PasswordHash  string     `json:"-"`
	Role          string     `json:"role"`
	FirstName     string     `json:"first_name"`
	LastName      string     `json:"last_name"`
	Points        int        `json:"points"`
	University    *string    `json:"university,omitempty"`
	Batch         *string    `json:"batch,omitempty"`
	Department    *string    `json:"department,omitempty"`
	Skills        *string    `json:"skills,omitempty"`
	CompanyName   *string    `json:"company_name,omitempty"`
	Industry      *string    `json:"industry,omitempty"`
	Website       *string    `json:"website,omitempty"`
	Description   *string    `json:"description,omitempty"`
	IsVerified    bool       `json:"is_verified"`
	VerifyCode    *string    `json:"-"`
	VerifyCodeExp *time.Time `json:"-"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// PublicUser is safe to return to the admin — no password, no OTP
type PublicUser struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Role        string    `json:"role"`
	FirstName   string    `json:"firstName"`
	LastName    string    `json:"lastName"`
	CompanyName *string   `json:"companyName,omitempty"`
	Industry    *string   `json:"industry,omitempty"`
	University  *string   `json:"university,omitempty"`
	Department  *string   `json:"department,omitempty"`
	IsVerified  bool      `json:"isVerified"`
	Points      int       `json:"points"`
	CreatedAt   time.Time `json:"createdAt"`
}

// PlatformStats is the admin overview payload
type PlatformStats struct {
	TotalWorkers      int `json:"totalWorkers"`
	TotalCompanies    int `json:"totalCompanies"`
	VerifiedWorkers   int `json:"verifiedWorkers"`
	VerifiedCompanies int `json:"verifiedCompanies"`
	TotalUsers        int `json:"totalUsers"`
	RecentSignups7d   int `json:"recentSignups7d"`
}

// ── Repository ────────────────────────────────────────────────────────────────

type UserRepo struct {
	db *pgxpool.Pool
}

func NewUserRepo(db *pgxpool.Pool) *UserRepo {
	return &UserRepo{db: db}
}

// ── Write operations ──────────────────────────────────────────────────────────

func (r *UserRepo) Create(ctx context.Context, u *User) (*User, error) {
	const q = `
		INSERT INTO users (
			email, password_hash, role, first_name, last_name,
			university, batch, department, skills,
			company_name, industry, website, description,
			verify_code, verify_code_exp
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11,
			$12, $13, $14, $15
		)
		RETURNING id, created_at, updated_at`

	row := r.db.QueryRow(ctx, q,
		u.Email, u.PasswordHash, u.Role, u.FirstName, u.LastName,
		u.University, u.Batch, u.Department, u.Skills,
		u.CompanyName, u.Industry,
		u.Website, u.Description,
		u.VerifyCode, u.VerifyCodeExp,
	)

	created := *u
	if err := row.Scan(&created.ID, &created.CreatedAt, &created.UpdatedAt); err != nil {
		return nil, err
	}
	return &created, nil
}

func (r *UserRepo) MarkVerified(ctx context.Context, userID string) error {
	const q = `
		UPDATE users
		SET    is_verified    = TRUE,
		       verify_code    = NULL,
		       verify_code_exp = NULL
		WHERE  id = $1`

	tag, err := r.db.Exec(ctx, q, userID)
	if err != nil {
		return err
	}

	if tag.RowsAffected() == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (r *UserRepo) UpdateProfile(ctx context.Context, userID string, fields map[string]any) (*User, error) {
	current, err := r.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	value := func(key string, fallback any) any {
		if v, ok := fields[key]; ok {
			return v
		}
		return fallback
	}
	const q = `UPDATE users SET first_name = COALESCE($2, first_name),
		last_name = COALESCE($3, last_name), university = $4, batch = $5,
		department = $6, skills = $7, company_name = $8, industry = $9,
		website = $10, description = $11, updated_at = NOW()
		WHERE id = $1`
	_, err = r.db.Exec(ctx, q, userID,
		value("firstName", current.FirstName), value("lastName", current.LastName),
		value("university", current.University), value("batch", current.Batch),
		value("department", current.Department), value("skills", current.Skills),
		value("companyName", current.CompanyName), value("industry", current.Industry),
		value("website", current.Website), value("description", current.Description))
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, userID)
}

func (r *UserRepo) UpdateVerifyCode(ctx context.Context, userID, code string, exp time.Time) error {
	const q = `
		UPDATE users
		SET    verify_code    = $1,
		       verify_code_exp = $2
		WHERE  id = $3`

	tag, err := r.db.Exec(ctx, q, code, exp, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("user not found")
	}
	return nil
}

// ── Read operations ───────────────────────────────────────────────────────────

func (r *UserRepo) FindByEmail(ctx context.Context, email string) (*User, error) {
	const q = `
		SELECT id, email, password_hash, role, first_name, last_name, points,
		       university, batch, department, skills,
		       company_name, industry, website, description,
		       is_verified, verify_code, verify_code_exp,
		       created_at, updated_at
		FROM   users
		WHERE  email = $1`

	u, err := scanUser(r.db.QueryRow(ctx, q, email))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

func (r *UserRepo) FindByID(ctx context.Context, id string) (*User, error) {
	const q = `
		SELECT id, email, password_hash, role, first_name, last_name, points,
		       university, batch, department, skills,
		       company_name, industry, website, description,
		       is_verified, verify_code, verify_code_exp,
		       created_at, updated_at
		FROM   users
		WHERE  id = $1`

	u, err := scanUser(r.db.QueryRow(ctx, q, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

// GetPlatformStats returns aggregate counts for the admin dashboard
func (r *UserRepo) GetPlatformStats(ctx context.Context) (*PlatformStats, error) {
	const q = `
		SELECT
			COUNT(*) FILTER (WHERE role = 'worker')                         AS total_workers,
			COUNT(*) FILTER (WHERE role = 'company')                        AS total_companies,
			COUNT(*) FILTER (WHERE role = 'worker'  AND is_verified = TRUE) AS verified_workers,
			COUNT(*) FILTER (WHERE role = 'company' AND is_verified = TRUE) AS verified_companies,
			COUNT(*) FILTER (WHERE role != 'admin')                         AS total_users,
			COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days' AND role != 'admin') AS recent_7d
		FROM users`

	var s PlatformStats
	err := r.db.QueryRow(ctx, q).Scan(
		&s.TotalWorkers, &s.TotalCompanies,
		&s.VerifiedWorkers, &s.VerifiedCompanies,
		&s.TotalUsers, &s.RecentSignups7d,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ListUsers returns all non-admin users with public fields only
func (r *UserRepo) ListUsers(ctx context.Context) ([]PublicUser, error) {
	const q = `
		SELECT id, email, role, first_name, last_name,
		       company_name, industry, university, department,
		       is_verified, points, created_at
		FROM   users
		WHERE  role != 'admin'
		ORDER  BY created_at DESC`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []PublicUser
	for rows.Next() {
		var u PublicUser
		if err := rows.Scan(
			&u.ID, &u.Email, &u.Role, &u.FirstName, &u.LastName,
			&u.CompanyName, &u.Industry, &u.University, &u.Department,
			&u.IsVerified, &u.Points, &u.CreatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func scanUser(row pgx.Row) (*User, error) {
	var u User
	err := row.Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.Role,
		&u.FirstName, &u.LastName, &u.Points,
		&u.University, &u.Batch, &u.Department, &u.Skills,
		&u.CompanyName, &u.Industry, &u.Website, &u.Description,
		&u.IsVerified, &u.VerifyCode, &u.VerifyCodeExp,
		&u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ── Admin seeding ─────────────────────────────────────────────────────────────

// EnsureAdminRoleAllowed relaxes the users.role check constraint to also allow 'admin'.
// Idempotent: drops any existing role check constraint, then (re)adds one allowing
// 'worker', 'company' and 'admin'.
func (r *UserRepo) EnsureAdminRoleAllowed(ctx context.Context) error {
	if _, err := r.db.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT`); err != nil {
		return fmt.Errorf("add website column: %w", err)
	}
	if _, err := r.db.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT`); err != nil {
		return fmt.Errorf("add description column: %w", err)
	}
	const dropSql = `DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'users'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c);
  END IF;
END $$;`
	if _, err := r.db.Exec(ctx, dropSql); err != nil {
		return fmt.Errorf("drop role check: %w", err)
	}
	const addSql = `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('worker','company','admin'));`
	if _, err := r.db.Exec(ctx, addSql); err != nil {
		// If a constraint with this name already exists that's acceptable.
		return nil
	}
	return nil
}

// EnsureAdmin creates the fixed admin account if it does not already exist.
// The password is hashed with bcrypt using the same scheme as normal registration,
// and the account is marked verified so it can sign in immediately.
func (r *UserRepo) EnsureAdmin(ctx context.Context, email, password, firstName, lastName string) error {
	existing, err := r.FindByEmail(ctx, email)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil // admin already present — do not overwrite its password
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	admin := &User{
		Email:        email,
		PasswordHash: string(hash),
		Role:         "admin",
		FirstName:    firstName,
		LastName:     lastName,
	}
	created, err := r.Create(ctx, admin)
	if err != nil {
		return err
	}
	return r.MarkVerified(ctx, created.ID)
}

// ── Password reset ────────────────────────────────────────────────────────────

// SetResetCode stores a 6-digit reset code (reuses verify_code columns).
func (r *UserRepo) SetResetCode(ctx context.Context, userID, code string, exp time.Time) error {
	const q = `UPDATE users SET verify_code=$1, verify_code_exp=$2 WHERE id=$3`
	tag, err := r.db.Exec(ctx, q, code, exp, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("user not found")
	}
	return nil
}

// ResetPassword validates the code and updates the password hash in one step.
func (r *UserRepo) ResetPassword(ctx context.Context, userID, newHash string) error {
	const q = `UPDATE users SET password_hash=$1, verify_code=NULL, verify_code_exp=NULL WHERE id=$2`
	tag, err := r.db.Exec(ctx, q, newHash, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("user not found")
	}
	return nil
}
