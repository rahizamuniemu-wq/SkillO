package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/skillo/backend/middleware"
	"github.com/skillo/backend/models"
)

type SubmissionHandler struct {
	subs  *models.SubmissionRepo
	jobs  *models.JobRepo
	users *models.UserRepo
}

func NewSubmissionHandler(subs *models.SubmissionRepo, jobs *models.JobRepo, users *models.UserRepo) *SubmissionHandler {
	return &SubmissionHandler{subs: subs, jobs: jobs, users: users}
}

// aiSkillCheck compares the job's required skills with the worker's profile skills.
// Returns (passed bool, aiNote string).
// Rule: every required skill domain must have at least one matching worker keyword.
// Extra skills on the worker's side are perfectly fine — they still pass.
// If the job has no required skills, it always passes.
func aiSkillCheck(jobSkills []string, workerSkillsStr string) (bool, string) {
	required := normalizedSkills(jobSkills)
	if len(required) == 0 {
		return true, "No specific skills required — submission accepted by AI."
	}

	workerTokens := skillTokens(workerSkillsStr)

	var missing []string
	var matched []string
	for _, skill := range required {
		if skillMatches(skill, workerTokens) {
			matched = append(matched, skill)
		} else {
			missing = append(missing, skill)
		}
	}

	if len(missing) > 0 {
		// One or more required skills are absent — reject
		note := fmt.Sprintf(
			"AI Review: Your profile is missing required skill(s): %s. "+
				"This task requires all of: %s. Submission rejected automatically. "+
				"Please update your profile skills and try again when you have the required expertise.",
			strings.Join(missing, ", "),
			strings.Join(required, ", "),
		)
		return false, note
	}

	// All required skills matched
	note := fmt.Sprintf("AI Review: All required skills matched (%s). Submission accepted.", strings.Join(matched, ", "))
	return true, note
}

func normalizedSkills(skills []string) []string {
	var result []string
	for _, s := range skills {
		if strings.TrimSpace(s) != "" {
			result = append(result, strings.TrimSpace(s))
		}
	}
	return result
}

func missingSkills(required []string, workerSkills string) []string {
	workerTokens := skillTokens(workerSkills)
	var missing []string
	for _, skill := range normalizedSkills(required) {
		if !skillMatches(skill, workerTokens) {
			missing = append(missing, skill)
		}
	}
	return missing
}

// skillTokens normalizes profile text and turns punctuation-separated skills
// into keywords. For example, "HTML/ React, Node.js" becomes html, react, node.
func skillTokens(raw string) map[string]struct{} {
	tokens := make(map[string]struct{})
	var current strings.Builder
	flush := func() {
		if current.Len() == 0 {
			return
		}
		tokens[canonicalSkill(current.String())] = struct{}{}
		current.Reset()
	}
	for _, r := range strings.ToLower(raw) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			current.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	return tokens
}

func canonicalSkill(token string) string {
	switch token {
	case "javascript", "javascriptes6", "ecmascript":
		return "js"
	case "typescript":
		return "ts"
	case "reactjs":
		return "react"
	case "nodejs":
		return "node"
	case "html5":
		return "html"
	case "css3":
		return "css"
	default:
		return token
	}
}

func skillMatches(required string, workerTokens map[string]struct{}) bool {
	for requiredToken := range skillTokens(required) {
		for workerToken := range workerTokens {
			if requiredToken == workerToken {
				return true
			}
			// Allow common forms such as react/reactjs and node/nodejs.
			if len(requiredToken) >= 3 &&
				(strings.Contains(workerToken, requiredToken) || strings.Contains(requiredToken, workerToken)) {
				return true
			}
		}
	}
	return false
}

func validateGitHubRepository(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || strings.ToLower(parsed.Hostname()) != "github.com" {
		return "GitHub URL must use the format https://github.com/username/repository."
	}

	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" || strings.Contains(parts[1], ".") {
		return "GitHub URL must point to a repository such as https://github.com/username/repository."
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Head("https://github.com/" + parts[0] + "/" + parts[1])
	if err != nil || resp.StatusCode >= http.StatusBadRequest {
		return "GitHub repository could not be reached. Check that the repository URL is public and correct."
	}
	resp.Body.Close()
	return ""
}

func validateLiveLink(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" {
		return "Live demo URL must use a reachable HTTPS address."
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || strings.HasPrefix(host, "127.") || strings.HasPrefix(host, "192.168.") || strings.HasPrefix(host, "10.") {
		return "Live demo URL must be publicly reachable, not localhost or a private network address."
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Head(raw)
	if err != nil || resp.StatusCode >= http.StatusBadRequest {
		if resp != nil {
			resp.Body.Close()
		}
		return "Live demo link could not be reached. Check that the deployed URL is public and correct."
	}
	resp.Body.Close()
	return ""
}

func validateAttachments(attachments []models.SubmissionAttachment, formats []string) string {
	required := normalizedSkills(formats)
	if len(required) == 0 {
		return ""
	}
	if len(attachments) == 0 {
		return "At least one file attachment is required. Allowed formats: " + strings.Join(required, ", ") + "."
	}
	allowed := map[string]bool{}
	for _, f := range required {
		allowed[strings.TrimPrefix(strings.ToLower(f), ".")] = true
	}
	var invalid []string
	for _, a := range attachments {
		ext := strings.TrimPrefix(strings.ToLower(path.Ext(a.Name)), ".")
		if ext == "" || !allowed[ext] {
			invalid = append(invalid, a.Name)
		}
	}
	if len(invalid) > 0 {
		return "Unsupported file format(s): " + strings.Join(invalid, ", ") + ". Allowed formats: " + strings.Join(required, ", ") + "."
	}
	return ""
}

// POST /api/submissions — worker submits work for a job.
// AI validation can reject a submission, but only company review may reopen a slot.
func (h *SubmissionHandler) Create(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" || role != "worker" {
		writeError(w, http.StatusForbidden, "only workers can submit work")
		return
	}

	var req struct {
		JobID       int                           `json:"jobId"`
		GitHub      string                        `json:"github"`
		Demo        string                        `json:"demo"`
		Attachments []models.SubmissionAttachment `json:"attachments"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.JobID == 0 || req.GitHub == "" {
		writeError(w, http.StatusBadRequest, "jobId and github are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	worker, err := h.users.FindByID(ctx, uid)
	if err != nil || worker == nil {
		writeError(w, http.StatusUnauthorized, "worker not found")
		return
	}

	job, err := h.jobs.GetByID(ctx, req.JobID)
	if err != nil || job == nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	if job.Status == "closed" {
		writeError(w, http.StatusBadRequest, "this task is closed and no longer accepting submissions")
		return
	}
	booked, err := h.jobs.HasActiveBooking(ctx, req.JobID, worker.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify your task booking")
		return
	}
	if !booked {
		writeError(w, http.StatusForbidden, "you must have an active booking for this task before submitting work")
		return
	}

	dup, _ := h.subs.ExistsByWorkerAndJob(ctx, worker.Email, req.JobID)
	if dup {
		writeError(w, http.StatusConflict, "you have already submitted work for this task")
		return
	}

	// ── AI validation checks ───────────────────────────────────────────────────
	workerSkills := ""
	if worker.Skills != nil {
		workerSkills = *worker.Skills
	}
	passed, aiNote := aiSkillCheck(job.Skills, workerSkills)
	if passed {
		if reason := validateGitHubRepository(req.GitHub); reason != "" {
			passed = false
			aiNote = "AI Review: Submission rejected — " + reason
		}
	}
	if passed {
		if reason := validateLiveLink(req.Demo); reason != "" {
			passed = false
			aiNote = "AI Review: Submission rejected — " + reason
		}
	}
	if passed {
		if reason := validateAttachments(req.Attachments, job.SubmissionFormats); reason != "" {
			passed = false
			aiNote = "AI Review: Submission rejected — " + reason
		}
	}

	initialStatus := "pending" // AI passed → awaits company review
	if !passed {
		initialStatus = "rejected" // AI rejected; the worker's reserved slot remains held
	}

	sub := &models.Submission{
		JobID:       req.JobID,
		WorkerID:    worker.ID,
		WorkerEmail: worker.Email,
		WorkerName:  worker.FirstName + " " + worker.LastName,
		GitHub:      req.GitHub,
		Demo:        req.Demo,
		Attachments: req.Attachments,
		AINote:      aiNote,
		Status:      initialStatus,
	}
	created, err := h.subs.Create(ctx, sub)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save submission")
		return
	}

	if passed {
		// Increment submission count and mark job as in-review
		status := "review"
		_, _ = h.jobs.Patch(ctx, req.JobID, models.JobPatch{Status: &status, SubmissionsDelta: intPtr(1)})
	} else {
		// AI rejection does not change slot ownership. Only company review may reopen it.
	}

	writeJSON(w, http.StatusCreated, created)
}

// GET /api/submissions — company: all their submissions (with worker profiles)
// GET /api/submissions?jobId=X — company: for one specific job
func (h *SubmissionHandler) List(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if role != "company" {
		writeError(w, http.StatusForbidden, "only companies can access this endpoint")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	company, err := h.users.FindByID(ctx, uid)
	if err != nil || company == nil {
		writeError(w, http.StatusUnauthorized, "company not found")
		return
	}

	jobIDStr := r.URL.Query().Get("jobId")
	if jobIDStr != "" {
		jobID, err := strconv.Atoi(jobIDStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid jobId")
			return
		}
		job, err := h.jobs.GetByID(ctx, jobID)
		if err != nil || job == nil || job.CompanyEmail != company.Email {
			writeError(w, http.StatusForbidden, "task not found or not yours")
			return
		}
		subs, err := h.subs.ListForJob(ctx, jobID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to fetch submissions")
			return
		}
		if subs == nil {
			subs = []models.Submission{}
		}
		writeJSON(w, http.StatusOK, subs)
		return
	}

	subs, err := h.subs.ListForCompany(ctx, company.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch submissions")
		return
	}
	if subs == nil {
		subs = []models.Submission{}
	}
	writeJSON(w, http.StatusOK, subs)
}

// GET /api/submissions/mine — worker's own submissions
func (h *SubmissionHandler) Mine(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" || role != "worker" {
		writeError(w, http.StatusForbidden, "only workers can access this endpoint")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	worker, err := h.users.FindByID(ctx, uid)
	if err != nil || worker == nil {
		writeError(w, http.StatusUnauthorized, "worker not found")
		return
	}

	subs, err := h.subs.ListForWorker(ctx, worker.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch submissions")
		return
	}
	if subs == nil {
		subs = []models.Submission{}
	}
	writeJSON(w, http.StatusOK, subs)
}

// PATCH /api/submissions/{id} — company rejects a submission from Evaluate Task (slot reopens)
// or the legacy "accepted" path is still allowed for backward compat.
func (h *SubmissionHandler) Review(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" || role != "company" {
		writeError(w, http.StatusForbidden, "only companies can review submissions")
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid submission id")
		return
	}

	var req struct {
		Status      string `json:"status"`
		Feedback    string `json:"feedback"`
		Rating      int    `json:"rating"`
		RestoreSlot bool   `json:"restore_slot"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Status != "accepted" && req.Status != "rejected" {
		writeError(w, http.StatusBadRequest, "status must be 'accepted' or 'rejected'")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	sub, err := h.subs.GetByID(ctx, id)
	if err != nil || sub == nil {
		writeError(w, http.StatusNotFound, "submission not found")
		return
	}
	company, _ := h.users.FindByID(ctx, uid)
	if company == nil || sub.CompanyEmail != company.Email {
		writeError(w, http.StatusForbidden, "you can only review submissions for your own tasks")
		return
	}

	if req.Status != "rejected" {
		req.RestoreSlot = false
	}
	updated, err := h.subs.UpdateReview(ctx, id, req.Status, req.Feedback, req.Rating, req.RestoreSlot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update submission")
		return
	}

	if req.Status == "rejected" && req.RestoreSlot && sub.Status != "rejected" {
		if err := h.jobs.RestoreSlotAndBanWorker(ctx, sub.JobID, sub.WorkerID); err != nil {
			writeError(w, http.StatusInternalServerError, "submission rejected but slot restoration failed")
			return
		}
	}

	writeJSON(w, http.StatusOK, updated)
}

// POST /api/jobs/{id}/distribute — company distributes rewards.
// Can distribute whenever there are accepted submissions (no longer requires ALL slots filled).
func (h *SubmissionHandler) Distribute(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" || role != "company" {
		writeError(w, http.StatusForbidden, "only companies can distribute rewards")
		return
	}

	jobID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job id")
		return
	}

	var req struct {
		Awards   []models.DistributeAward `json:"awards"`
		WinnerID int                      `json:"winnerId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Awards) == 0 || req.WinnerID == 0 {
		writeError(w, http.StatusBadRequest, "awards and winnerId are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	job, err := h.jobs.GetByID(ctx, jobID)
	if err != nil || job == nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	company, _ := h.users.FindByID(ctx, uid)
	if company == nil || job.CompanyEmail != company.Email {
		writeError(w, http.StatusForbidden, "you can only distribute rewards for your own tasks")
		return
	}

	if err := h.subs.Distribute(ctx, jobID, req.Awards, req.WinnerID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to distribute rewards: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Rewards distributed and job closed."})
}

func intPtr(v int) *int { return &v }
