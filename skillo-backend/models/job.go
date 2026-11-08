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

// JobMaterial mirrors the frontend material object attached to a task.
type JobMaterial struct {
	Type   string `json:"type"`
	Label  string `json:"label"`
	URL    string `json:"url"`
	Source string `json:"source"`
	Size   string `json:"size,omitempty"`
}

// Job is a marketplace task posted by a company. Company details are denormalised
// at creation time so the list always shows "which company posted which task".
type Job struct {
	ID                int           `json:"id"`
	CompanyID         string        `json:"companyId,omitempty"`
	CompanyName       string        `json:"companyName"`
	CompanyEmail      string        `json:"companyEmail"`
	Industry          string        `json:"industry,omitempty"`
	Title             string        `json:"title"`
	Category          string        `json:"category"`
	Description       string        `json:"description"`
	Skills            []string      `json:"skills"`
	Slots             int           `json:"slots"`
	Filled            int           `json:"filled"`
	Deadline          string        `json:"deadline"`
	Reward            int           `json:"reward"`
	Points            int           `json:"points"`
	Difficulty        string        `json:"difficulty"`
	Status            string        `json:"status"`
	Submissions       int           `json:"submissions"`
	UseAI             bool          `json:"useAI"`
	Materials         []JobMaterial `json:"materials"`
	SubmissionFormats []string      `json:"submissionFormats"`
	IsDemo            bool          `json:"isDemo,omitempty"`
	CreatedAt         time.Time     `json:"createdAt,omitempty"`
}

// JobPatch describes a partial update. Pointer fields are only applied when set.
type JobPatch struct {
	Title             *string        `json:"title,omitempty"`
	Reward            *int           `json:"reward,omitempty"`
	Deadline          *string        `json:"deadline,omitempty"`
	Status            *string        `json:"status,omitempty"`
	FilledDelta       *int           `json:"filledDelta,omitempty"`
	SubmissionsDelta  *int           `json:"submissionsDelta,omitempty"`
	Materials         *[]JobMaterial `json:"materials,omitempty"`
	SubmissionFormats *[]string      `json:"submissionFormats,omitempty"`
}

type JobRepo struct {
	db *pgxpool.Pool
}

func NewJobRepo(db *pgxpool.Pool) *JobRepo { return &JobRepo{db: db} }

const jobsTableSQL = `
CREATE TABLE IF NOT EXISTS jobs (
    id              SERIAL PRIMARY KEY,
    company_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    company_name    TEXT NOT NULL,
    company_email   TEXT NOT NULL,
    industry        TEXT,
    title           TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'Other',
    description     TEXT NOT NULL DEFAULT '',
    skills          JSONB NOT NULL DEFAULT '[]',
    slots           INTEGER NOT NULL DEFAULT 1,
    filled          INTEGER NOT NULL DEFAULT 0,
    deadline        TEXT NOT NULL DEFAULT '',
    reward          INTEGER NOT NULL DEFAULT 0,
    points          INTEGER NOT NULL DEFAULT 0,
    difficulty      TEXT NOT NULL DEFAULT 'Intermediate',
    status          TEXT NOT NULL DEFAULT 'active',
    submissions     INTEGER NOT NULL DEFAULT 0,
    use_ai          BOOLEAN NOT NULL DEFAULT FALSE,
    materials       JSONB NOT NULL DEFAULT '[]',
    submission_formats JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`

const jobsIndexSQL = `CREATE INDEX IF NOT EXISTS idx_jobs_company_email ON jobs (company_email)`

// EnsureJobsTable creates the jobs table if it does not yet exist (idempotent).
func (r *JobRepo) EnsureJobsTable(ctx context.Context) error {
	if _, err := r.db.Exec(ctx, jobsTableSQL); err != nil {
		return fmt.Errorf("create jobs table: %w", err)
	}
	if _, err := r.db.Exec(ctx, jobsIndexSQL); err != nil {
		return fmt.Errorf("jobs index: %w", err)
	}
	if _, err := r.db.Exec(ctx, `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS submission_formats JSONB NOT NULL DEFAULT '[]'`); err != nil {
		return fmt.Errorf("jobs submission formats: %w", err)
	}
	if _, err := r.db.Exec(ctx, `CREATE TABLE IF NOT EXISTS job_bookings (
		job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
		worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (job_id, worker_id)
	)`); err != nil {
		return fmt.Errorf("job bookings table: %w", err)
	}
	if _, err := r.db.Exec(ctx, `CREATE TABLE IF NOT EXISTS job_booking_bans (
		job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
		worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (job_id, worker_id)
	)`); err != nil {
		return fmt.Errorf("job booking bans table: %w", err)
	}
	if _, err := r.db.Exec(ctx, `UPDATE jobs j
		SET filled = (
			SELECT COUNT(*) FROM job_bookings b
			WHERE b.job_id = j.id
		)`); err != nil {
		return fmt.Errorf("reconcile job slot counts: %w", err)
	}
	return nil
}

const jobColumns = `id, company_id, company_name, company_email, industry, title, category, description, skills, slots, filled, deadline, reward, points, difficulty, status, submissions, use_ai, materials, submission_formats, created_at`

type scanner interface{ Scan(dest ...any) error }

func scanJob(row scanner) (*Job, error) {
	var j Job
	var companyID *string
	var skillsJSON, matJSON, formatsJSON []byte
	err := row.Scan(
		&j.ID, &companyID, &j.CompanyName, &j.CompanyEmail, &j.Industry,
		&j.Title, &j.Category, &j.Description, &skillsJSON, &j.Slots, &j.Filled,
		&j.Deadline, &j.Reward, &j.Points, &j.Difficulty, &j.Status, &j.Submissions,
		&j.UseAI, &matJSON, &formatsJSON, &j.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if companyID != nil {
		j.CompanyID = *companyID
	}
	_ = json.Unmarshal(skillsJSON, &j.Skills)
	_ = json.Unmarshal(matJSON, &j.Materials)
	if j.Skills == nil {
		j.Skills = []string{}
	}
	if j.Materials == nil {
		j.Materials = []JobMaterial{}
	}
	_ = json.Unmarshal(formatsJSON, &j.SubmissionFormats)
	if j.SubmissionFormats == nil {
		j.SubmissionFormats = []string{}
	}
	return &j, nil
}

func (r *JobRepo) Create(ctx context.Context, j *Job) (*Job, error) {
	skillsJSON, err := json.Marshal(j.Skills)
	if err != nil {
		skillsJSON = []byte("[]")
	}
	matJSON, err := json.Marshal(j.Materials)
	if err != nil {
		matJSON = []byte("[]")
	}
	formatsJSON, err := json.Marshal(j.SubmissionFormats)
	if err != nil {
		formatsJSON = []byte("[]")
	}
	const q = `INSERT INTO jobs (
		company_id, company_name, company_email, industry, title, category, description,
		skills, slots, deadline, reward, points, difficulty, use_ai, materials, submission_formats
	) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
	RETURNING id, filled, status, submissions, created_at`

	created := *j
	err = r.db.QueryRow(ctx, q,
		j.CompanyID, j.CompanyName, j.CompanyEmail, j.Industry,
		j.Title, j.Category, j.Description, string(skillsJSON),
		j.Slots, j.Deadline, j.Reward, j.Points, j.Difficulty, j.UseAI, string(matJSON), string(formatsJSON),
	).Scan(&created.ID, &created.Filled, &created.Status, &created.Submissions, &created.CreatedAt)
	if err != nil {
		return nil, err
	}
	if created.Skills == nil {
		created.Skills = []string{}
	}
	if created.Materials == nil {
		created.Materials = []JobMaterial{}
	}
	if created.SubmissionFormats == nil {
		created.SubmissionFormats = []string{}
	}
	return &created, nil
}

func (r *JobRepo) Book(ctx context.Context, jobID int, workerID string) (*Job, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}

	defer tx.Rollback(ctx)

	var banned bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM job_booking_bans WHERE job_id=$1 AND worker_id=$2)`, jobID, workerID).Scan(&banned); err != nil {
		return nil, err
	}
	if banned {
		return nil, errors.New("you are permanently barred from booking this task")
	}

	tag, err := tx.Exec(ctx, `INSERT INTO job_bookings (job_id, worker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, jobID, workerID)
	if err != nil {
		return nil, err
	}

	if tag.RowsAffected() == 0 {
		return nil, errors.New("you have already booked this task")
	}

	job, err := scanJob(tx.QueryRow(ctx, `UPDATE jobs SET filled = (
		SELECT COUNT(*) FROM job_bookings WHERE job_id = $1
	), updated_at = NOW()
	WHERE id = $1
	  AND status IN ('active', 'review')
	  AND (SELECT COUNT(*) FROM job_bookings WHERE job_id = $1) <= slots
	RETURNING `+jobColumns, jobID))
	if err != nil {
		_, _ = tx.Exec(ctx, `DELETE FROM job_bookings WHERE job_id = $1 AND worker_id = $2`, jobID, workerID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("no slots are available for this task")
		}
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return job, nil
}

func (r *JobRepo) HasActiveBooking(ctx context.Context, jobID int, workerID string) (bool, error) {
	var booked bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM job_bookings b
		WHERE b.job_id=$1 AND b.worker_id=$2
		  AND NOT EXISTS (
			SELECT 1 FROM job_booking_bans ban
			WHERE ban.job_id=b.job_id AND ban.worker_id=b.worker_id
		  )
	)`, jobID, workerID).Scan(&booked)
	return booked, err
}

func (r *JobRepo) ListBookedForWorker(ctx context.Context, workerID string) ([]int, error) {
	rows, err := r.db.Query(ctx, `SELECT job_id FROM job_bookings WHERE worker_id=$1 ORDER BY created_at DESC`, workerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *JobRepo) RestoreSlotAndBanWorker(ctx context.Context, jobID int, workerID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `DELETE FROM job_bookings WHERE job_id=$1 AND worker_id=$2`, jobID, workerID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO job_booking_bans (job_id, worker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, jobID, workerID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE jobs SET filled = (
		SELECT COUNT(*) FROM job_bookings WHERE job_id = $1
	), updated_at = NOW() WHERE id = $1`, jobID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *JobRepo) ListAll(ctx context.Context) ([]Job, error) {
	rows, err := r.db.Query(ctx, `SELECT `+jobColumns+` FROM jobs ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Job
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *j)
	}
	return out, nil
}

func (r *JobRepo) GetByID(ctx context.Context, id int) (*Job, error) {
	j, err := scanJob(r.db.QueryRow(ctx, `SELECT `+jobColumns+` FROM jobs WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return j, err
}

// Patch applies a partial update and returns the resulting job.
func (r *JobRepo) Patch(ctx context.Context, id int, p JobPatch) (*Job, error) {
	sets := []string{}
	args := []any{id}
	idx := 2
	add := func(col string, val any) {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, idx))
		args = append(args, val)
		idx++
	}
	if p.Title != nil {
		add("title", *p.Title)
	}
	if p.Reward != nil {
		add("reward", *p.Reward)
	}
	if p.Deadline != nil {
		add("deadline", *p.Deadline)
	}
	if p.Status != nil {
		add("status", *p.Status)
	}
	if p.FilledDelta != nil {
		sets = append(sets, fmt.Sprintf("filled = GREATEST(0, filled + $%d)", idx))
		args = append(args, *p.FilledDelta)
		idx++
	}
	if p.SubmissionsDelta != nil {
		sets = append(sets, fmt.Sprintf("submissions = GREATEST(0, submissions + $%d)", idx))
		args = append(args, *p.SubmissionsDelta)
		idx++
	}
	if p.Materials != nil {
		value, err := json.Marshal(*p.Materials)
		if err != nil {
			return nil, err
		}
		add("materials", string(value))
	}
	if p.SubmissionFormats != nil {
		value, err := json.Marshal(*p.SubmissionFormats)
		if err != nil {
			return nil, err
		}
		add("submission_formats", string(value))
	}
	if len(sets) == 0 {
		return r.GetByID(ctx, id)
	}
	sets = append(sets, "updated_at = NOW()")
	q := fmt.Sprintf("UPDATE jobs SET %s WHERE id = $1 RETURNING %s", strings.Join(sets, ", "), jobColumns)
	return scanJob(r.db.QueryRow(ctx, q, args...))
}

// Delete permanently removes a job and all its submissions (via ON DELETE CASCADE).
func (r *JobRepo) Delete(ctx context.Context, id int) error {
	_, err := r.db.Exec(ctx, `DELETE FROM jobs WHERE id = $1`, id)
	return err
}
