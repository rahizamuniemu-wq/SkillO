package models

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// WorkerProfile is the public student profile attached to each submission.
// Never includes password, OTP, or any secret field.
type WorkerProfile struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	FirstName  string `json:"firstName"`
	LastName   string `json:"lastName"`
	University string `json:"university,omitempty"`
	Department string `json:"department,omitempty"`
	Skills     string `json:"skills,omitempty"`
	Points     int    `json:"points"`
}

// Submission is a student's work submission for a job.
type Submission struct {
	ID            int                    `json:"id"`
	JobID         int                    `json:"jobId"`
	JobTitle      string                 `json:"jobTitle,omitempty"`
	CompanyName   string                 `json:"companyName,omitempty"`
	CompanyEmail  string                 `json:"companyEmail,omitempty"`
	WorkerID      string                 `json:"workerId,omitempty"`
	WorkerEmail   string                 `json:"workerEmail"`
	WorkerName    string                 `json:"workerName"`
	Worker        *WorkerProfile         `json:"worker,omitempty"`
	GitHub        string                 `json:"github"`
	Demo          string                 `json:"demo"`
	Attachments   []SubmissionAttachment `json:"attachments"`
	Status        string                 `json:"status"` // pending | accepted | rejected
	RestoreSlot   bool                   `json:"restoreSlot"`
	AINote        string                 `json:"aiNote"`
	IsWinner      bool                   `json:"isWinner"`
	PointsAwarded int                    `json:"pointsAwarded"`
	Feedback      string                 `json:"feedback"`
	Rating        int                    `json:"rating"`
	CreatedAt     time.Time              `json:"createdAt"`
}

type SubmissionAttachment struct {
	Name string `json:"name"`
	URL  string `json:"url"`
	Type string `json:"type,omitempty"`
}

type SubmissionRepo struct {
	db *pgxpool.Pool
}

func NewSubmissionRepo(db *pgxpool.Pool) *SubmissionRepo { return &SubmissionRepo{db: db} }

// EnsureSubmissionsTable creates the submissions table if it does not exist.
// NOTE: each Exec call contains exactly ONE statement (pgx extended protocol requirement).
func (r *SubmissionRepo) EnsureSubmissionsTable(ctx context.Context) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS submissions (
			id             SERIAL PRIMARY KEY,
			job_id         INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
			worker_id      UUID REFERENCES users(id) ON DELETE SET NULL,
			worker_email   TEXT NOT NULL,
			worker_name    TEXT NOT NULL,
			github         TEXT NOT NULL DEFAULT '',
			demo           TEXT NOT NULL DEFAULT '',
			status         TEXT NOT NULL DEFAULT 'accepted',
			ai_note        TEXT NOT NULL DEFAULT '',
			is_winner      BOOLEAN NOT NULL DEFAULT FALSE,
			points_awarded INTEGER NOT NULL DEFAULT 0,
			feedback       TEXT NOT NULL DEFAULT '',
			rating         INTEGER NOT NULL DEFAULT 0,
			attachments    JSONB NOT NULL DEFAULT '[]',
			restore_slot   BOOLEAN NOT NULL DEFAULT FALSE,
			created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_submissions_job_id      ON submissions (job_id)`,
		`CREATE INDEX IF NOT EXISTS idx_submissions_worker_email ON submissions (worker_email)`,
		// Add ai_note column to existing tables (idempotent)
		`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_note TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'`,
		`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS restore_slot BOOLEAN NOT NULL DEFAULT FALSE`,
	}
	for _, s := range stmts {
		if _, err := r.db.Exec(ctx, s); err != nil {
			return fmt.Errorf("submissions schema: %w", err)
		}
	}
	return nil
}

func (r *SubmissionRepo) Create(ctx context.Context, s *Submission) (*Submission, error) {
	const q = `INSERT INTO submissions (job_id, worker_id, worker_email, worker_name, github, demo, status, ai_note, attachments)
	           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	           RETURNING id, status, ai_note, is_winner, points_awarded, feedback, rating, created_at`
	created := *s
	attachmentsJSON, _ := json.Marshal(s.Attachments)
	err := r.db.QueryRow(ctx, q, s.JobID, s.WorkerID, s.WorkerEmail, s.WorkerName, s.GitHub, s.Demo, s.Status, s.AINote, string(attachmentsJSON)).
		Scan(&created.ID, &created.Status, &created.AINote, &created.IsWinner, &created.PointsAwarded, &created.Feedback, &created.Rating, &created.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &created, nil
}

// ListForJob returns all submissions for a job, with the worker's public profile joined in.
func (r *SubmissionRepo) ListForJob(ctx context.Context, jobID int) ([]Submission, error) {
	const q = `
	SELECT s.id, s.job_id, j.title, j.company_name, j.company_email,
	       s.worker_id, s.worker_email, s.worker_name,
	       s.github, s.demo, s.status, s.ai_note, s.restore_slot, s.is_winner, s.points_awarded, s.feedback, s.rating, s.attachments, s.created_at,
	       u.id, u.email, u.first_name, u.last_name,
	       COALESCE(u.university,''), COALESCE(u.department,''), COALESCE(u.skills,''), u.points
	FROM submissions s
	JOIN jobs j ON j.id = s.job_id
	LEFT JOIN users u ON u.id = s.worker_id
	WHERE s.job_id = $1
	ORDER BY s.created_at ASC`
	return r.scanRows(ctx, q, jobID)
}

// ListForCompany returns all submissions across all jobs owned by the company.
func (r *SubmissionRepo) ListForCompany(ctx context.Context, companyEmail string) ([]Submission, error) {
	const q = `
	SELECT s.id, s.job_id, j.title, j.company_name, j.company_email,
	       s.worker_id, s.worker_email, s.worker_name,
	       s.github, s.demo, s.status, s.ai_note, s.restore_slot, s.is_winner, s.points_awarded, s.feedback, s.rating, s.attachments, s.created_at,
	       u.id, u.email, u.first_name, u.last_name,
	       COALESCE(u.university,''), COALESCE(u.department,''), COALESCE(u.skills,''), u.points
	FROM submissions s
	JOIN jobs j ON j.id = s.job_id
	LEFT JOIN users u ON u.id = s.worker_id
	WHERE j.company_email = $1
	ORDER BY s.created_at ASC`
	return r.scanRows(ctx, q, companyEmail)
}

// ListForWorker returns a worker's own submissions with job info.
func (r *SubmissionRepo) ListForWorker(ctx context.Context, workerEmail string) ([]Submission, error) {
	const q = `
	SELECT s.id, s.job_id, j.title, j.company_name, j.company_email,
	       s.worker_id, s.worker_email, s.worker_name,
	       s.github, s.demo, s.status, s.ai_note, s.restore_slot, s.is_winner, s.points_awarded, s.feedback, s.rating, s.attachments, s.created_at,
	       u.id, u.email, u.first_name, u.last_name,
	       COALESCE(u.university,''), COALESCE(u.department,''), COALESCE(u.skills,''), u.points
	FROM submissions s
	JOIN jobs j ON j.id = s.job_id
	LEFT JOIN users u ON u.id = s.worker_id
	WHERE s.worker_email = $1
	ORDER BY s.created_at ASC`
	return r.scanRows(ctx, q, workerEmail)
}

func (r *SubmissionRepo) GetByID(ctx context.Context, id int) (*Submission, error) {
	const q = `
	SELECT s.id, s.job_id, j.title, j.company_name, j.company_email,
	       s.worker_id, s.worker_email, s.worker_name,
	       s.github, s.demo, s.status, s.ai_note, s.restore_slot, s.is_winner, s.points_awarded, s.feedback, s.rating, s.attachments, s.created_at,
	       u.id, u.email, u.first_name, u.last_name,
	       COALESCE(u.university,''), COALESCE(u.department,''), COALESCE(u.skills,''), u.points
	FROM submissions s
	JOIN jobs j ON j.id = s.job_id
	LEFT JOIN users u ON u.id = s.worker_id
	WHERE s.id = $1`
	rows, err := r.scanRows(ctx, q, id)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	return &rows[0], nil
}

func (r *SubmissionRepo) ExistsByWorkerAndJob(ctx context.Context, workerEmail string, jobID int) (bool, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM submissions WHERE worker_email=$1 AND job_id=$2 AND status <> 'rejected'`, workerEmail, jobID).Scan(&n)
	return n > 0, err
}

func (r *SubmissionRepo) UpdateReview(ctx context.Context, id int, status, feedback string, rating int, restoreSlot bool) (*Submission, error) {
	const q = `UPDATE submissions SET status=$2, feedback=$3, rating=$4, restore_slot=$5 WHERE id=$1`
	if _, err := r.db.Exec(ctx, q, id, status, feedback, rating, restoreSlot); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *SubmissionRepo) AcceptedCount(ctx context.Context, jobID int) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM submissions WHERE job_id=$1 AND status='accepted'`, jobID).Scan(&n)
	return n, err
}

// DistributeAward is input for one accepted submission in the reward-distribution step.
type DistributeAward struct {
	SubmissionID int    `json:"submissionId"`
	Points       int    `json:"points"`
	Rating       int    `json:"rating"`
	Feedback     string `json:"feedback"`
}

// Distribute runs in a single transaction:
// - sets each award's points_awarded, feedback, status='accepted'
// - marks the winner's is_winner=true
// - adds points to each worker's users.points
// - sets the job status to 'closed'
func (r *SubmissionRepo) Distribute(ctx context.Context, jobID int, awards []DistributeAward, winnerID int) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, a := range awards {
		isWin := a.SubmissionID == winnerID
		_, err := tx.Exec(ctx,
			`UPDATE submissions SET points_awarded=$2, rating=$3, feedback=$4, is_winner=$5, status='accepted'
			 WHERE id=$1`,
			a.SubmissionID, a.Points, a.Rating, a.Feedback, isWin)
		if err != nil {
			return fmt.Errorf("update submission %d: %w", a.SubmissionID, err)
		}
		// Add points to the student's profile
		if a.Points > 0 {
			_, err = tx.Exec(ctx,
				`UPDATE users SET points = points + $2
				 WHERE id = (SELECT worker_id FROM submissions WHERE id=$1)`,
				a.SubmissionID, a.Points)
			if err != nil {
				return fmt.Errorf("award points for submission %d: %w", a.SubmissionID, err)
			}
		}
	}

	// Close the job
	_, err = tx.Exec(ctx, `UPDATE jobs SET status='closed', updated_at=NOW() WHERE id=$1`, jobID)
	if err != nil {
		return fmt.Errorf("close job: %w", err)
	}

	return tx.Commit(ctx)
}

// ── helpers ────────────────────────────────────────────────────────────────────

func (r *SubmissionRepo) scanRows(ctx context.Context, q string, arg any) ([]Submission, error) {
	rows, err := r.db.Query(ctx, q, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Submission
	for rows.Next() {
		s, err := scanSubmissionRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func scanSubmissionRow(row pgx.Row) (Submission, error) {
	var s Submission
	var wp WorkerProfile
	var workerID *string
	var attachmentsJSON []byte
	err := row.Scan(
		&s.ID, &s.JobID, &s.JobTitle, &s.CompanyName, &s.CompanyEmail,
		&workerID, &s.WorkerEmail, &s.WorkerName,
		&s.GitHub, &s.Demo, &s.Status, &s.AINote, &s.RestoreSlot, &s.IsWinner, &s.PointsAwarded, &s.Feedback, &s.Rating, &attachmentsJSON, &s.CreatedAt,
		&wp.ID, &wp.Email, &wp.FirstName, &wp.LastName,
		&wp.University, &wp.Department, &wp.Skills, &wp.Points,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return s, pgx.ErrNoRows
		}
		return s, err
	}
	if workerID != nil {
		s.WorkerID = *workerID
	}
	_ = json.Unmarshal(attachmentsJSON, &s.Attachments)
	if s.Attachments == nil {
		s.Attachments = []SubmissionAttachment{}
	}
	s.Worker = &wp
	return s, nil
}

// UpdatePoints adds delta points to a user — used for backward-compat awardWorker calls.
func (r *SubmissionRepo) UpdatePoints(ctx context.Context, userID string, delta int) error {
	sets := []string{"points = points + $2"}
	args := []any{userID, delta}
	q := fmt.Sprintf("UPDATE users SET %s WHERE id=$1", strings.Join(sets, ","))
	_, err := r.db.Exec(ctx, q, args...)
	return err
}
