package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/skillo/backend/middleware"
	"github.com/skillo/backend/models"
)

type JobHandler struct {
	jobs  *models.JobRepo
	users *models.UserRepo
}

func NewJobHandler(jobs *models.JobRepo, users *models.UserRepo) *JobHandler {
	return &JobHandler{jobs: jobs, users: users}
}

type jobSuggestionRequest struct {
	Title       string               `json:"title"`
	Category    string               `json:"category"`
	Description string               `json:"description"`
	Materials   []models.JobMaterial `json:"materials"`
}

type jobSuggestion struct {
	Skills            []string             `json:"skills"`
	Points            int                  `json:"points"`
	SubmissionFormats []string             `json:"submissionFormats"`
	Resources         []models.JobMaterial `json:"resources"`
	Rationale         string               `json:"rationale"`
}

// CallGeminiAI generates text using the Generative Language API.
func CallGeminiAI(promptText string) (string, error) {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	fmt.Printf("DEBUG: Loaded API Key length: %d\n", len(apiKey))
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not configured")
	}

	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-1.5-flash"
	}

	payload := struct {
		Contents []struct {
			Role  string `json:"role"`
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"contents"`
		GenerationConfig struct {
			Temperature     float64 `json:"temperature"`
			MaxOutputTokens int     `json:"maxOutputTokens"`
		} `json:"generationConfig"`
	}{}
	payload.Contents = []struct {
		Role  string `json:"role"`
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	}{{
		Role: "user",
		Parts: []struct {
			Text string `json:"text"`
		}{{Text: promptText}},
	}}
	payload.GenerationConfig.Temperature = 0.4
	payload.GenerationConfig.MaxOutputTokens = 2048

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal Gemini request: %w", err)
	}

	endpoint := "https://generativelanguage.googleapis.com/v1beta/models/" +
		url.PathEscape(model) + ":generateContent"
	client := &http.Client{Timeout: 90 * time.Second}
	const maxRetries = 3
	for attempt := 0; attempt <= maxRetries; attempt++ {
		request, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
		if err != nil {
			return "", fmt.Errorf("create Gemini request: %w", err)
		}
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("x-goog-api-key", apiKey)

		response, err := client.Do(request)
		if err != nil {
			if attempt < maxRetries && isTransientGeminiError(err) {
				delay := time.Duration(1<<attempt) * time.Second
				log.Printf("Gemini request attempt %d/%d failed with transient error: %v; retrying in %s", attempt+1, maxRetries+1, err, delay)
				time.Sleep(delay)
				continue
			}
			return "", fmt.Errorf("send Gemini request: %w", err)
		}

		responseBody, readErr := io.ReadAll(response.Body)
		response.Body.Close()
		if readErr != nil {
			if attempt < maxRetries {
				delay := time.Duration(1<<attempt) * time.Second
				log.Printf("Gemini response attempt %d/%d could not be read: %v; retrying in %s", attempt+1, maxRetries+1, readErr, delay)
				time.Sleep(delay)
				continue
			}
			return "", fmt.Errorf("read Gemini response: %w", readErr)
		}
		if len(bytes.TrimSpace(responseBody)) == 0 {
			log.Printf("Gemini API returned an empty response body: %q", string(responseBody))
			return "", fmt.Errorf("Gemini API returned an empty response body")
		}

		if response.StatusCode != http.StatusOK {
			if attempt < maxRetries && isTransientGeminiStatus(response.StatusCode) {
				delay := time.Duration(1<<attempt) * time.Second
				log.Printf("Gemini request attempt %d/%d returned status %d; retrying in %s", attempt+1, maxRetries+1, response.StatusCode, delay)
				time.Sleep(delay)
				continue
			}
			return "", fmt.Errorf("Gemini API returned status code %d: %s", response.StatusCode, string(responseBody))
		}

		var result map[string]any
		if err := json.Unmarshal(responseBody, &result); err != nil {
			log.Printf("Gemini API returned malformed response JSON: %q", string(responseBody))
			return "", fmt.Errorf("failed to decode response: %w", err)
		}

		candidates, ok := result["candidates"].([]any)
		if !ok || len(candidates) == 0 {
			log.Printf("Gemini API response contained no candidates; raw response: %q", string(responseBody))
			if promptFeedback, hasFeedback := result["promptFeedback"].(map[string]any); hasFeedback {
				return "", fmt.Errorf("Gemini blocked prompt: %v", promptFeedback)
			}
			return "", fmt.Errorf("no candidates returned from Gemini API (response: %+v)", result)
		}

		candidate, ok := candidates[0].(map[string]any)
		if !ok {
			log.Printf("Gemini API response contained an invalid candidate; raw response: %q", string(responseBody))
			return "", fmt.Errorf("Gemini response contained an invalid candidate")
		}
		content, ok := candidate["content"].(map[string]any)
		if !ok {
			log.Printf("Gemini API candidate had empty content; raw response: %q", string(responseBody))
			return "", fmt.Errorf("Gemini response candidate did not contain content")
		}
		parts, ok := content["parts"].([]any)
		if !ok || len(parts) == 0 {
			log.Printf("Gemini API candidate had empty parts; raw response: %q", string(responseBody))
			return "", fmt.Errorf("Gemini response candidate did not contain parts")
		}
		part, ok := parts[0].(map[string]any)
		if !ok {
			log.Printf("Gemini API response contained an invalid content part; raw response: %q", string(responseBody))
			return "", fmt.Errorf("Gemini response contained an invalid content part")
		}
		text, ok := part["text"].(string)
		if !ok {
			log.Printf("Gemini API candidate text was empty or invalid; raw response: %q", string(responseBody))
			return "", fmt.Errorf("Gemini response content part did not contain text")
		}

		// Clean up markdown code blocks and extract the pure JSON object.
		text = strings.TrimSpace(text)
		if strings.HasPrefix(text, "```json") {
			text = strings.TrimPrefix(text, "```json")
		} else if strings.HasPrefix(text, "```") {
			text = strings.TrimPrefix(text, "```")
		}
		if strings.HasSuffix(text, "```") {
			text = strings.TrimSuffix(text, "```")
		}
		text = strings.TrimSpace(text)
		if idxOpen := strings.Index(text, "{"); idxOpen >= 0 {
			if idxClose := strings.LastIndex(text, "}"); idxClose > idxOpen {
				text = text[idxOpen : idxClose+1]
			}
		}
		text = escapeRawJSONStringNewlines(text)
		if text == "" {
			log.Printf("Gemini API candidate text was empty after cleanup; raw response: %q", string(responseBody))
			return "", fmt.Errorf("Gemini response did not contain text")
		}
		return text, nil
	}

	return "", fmt.Errorf("Gemini request failed after %d retries", maxRetries)
}

func isTransientGeminiStatus(status int) bool {
	return status == http.StatusRequestTimeout ||
		status == http.StatusTooManyRequests ||
		status >= http.StatusInternalServerError
}

func isTransientGeminiError(err error) bool {
	var networkErr net.Error
	return errors.As(err, &networkErr) && (networkErr.Timeout() || networkErr.Temporary())
}

func escapeRawJSONStringNewlines(text string) string {
	var cleaned strings.Builder
	cleaned.Grow(len(text))

	inString := false
	escaped := false
	for _, char := range text {
		if inString {
			if escaped {
				cleaned.WriteRune(char)
				escaped = false
				continue
			}
			switch char {
			case '\\':
				cleaned.WriteRune(char)
				escaped = true
			case '"':
				cleaned.WriteRune(char)
				inString = false
			case '\n':
				cleaned.WriteString(`\n`)
			case '\r':
				cleaned.WriteString(`\r`)
			default:
				cleaned.WriteRune(char)
			}
			continue
		}

		cleaned.WriteRune(char)
		if char == '"' {
			inString = true
		}
	}

	return cleaned.String()
}

// Suggest uses Gemini to propose task settings.
// Suggestions are never persisted until the company explicitly applies them.
func (h *JobHandler) Suggest(w http.ResponseWriter, r *http.Request) {
	if middleware.GetUserID(r) == "" || middleware.GetUserRole(r) != "company" {
		writeError(w, http.StatusForbidden, "only companies can request task suggestions")
		return
	}
	var req jobSuggestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Description) == "" {
		writeError(w, http.StatusBadRequest, "a task description is required")
		return
	}

	input, err := json.Marshal(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task details")
		return
	}
	prompt := `Analyze this task description and attached learning materials. Return ONLY valid JSON matching this shape:
{"skills":["skill"],"points":50,"submissionFormats":["github","vercel","pdf","png","mp4"],"resources":[{"type":"video","label":"...","url":"https://...","source":"link"}],"rationale":"..."}
Recommend only skills genuinely needed, points from 10 to 500 based on complexity, and practical submission formats. Find up to 3 current, free, publicly accessible learning resources directly related to the task. Prefer official documentation, reputable articles, or YouTube. Do not invent URLs. Resource source must be "link". Task details: ` + string(input)

	suggestionText, err := CallGeminiAI(prompt)
	if err != nil {
		log.Printf("Gemini API request failed: %v", err)
		suggestion := fallbackJobSuggestion()
		log.Printf("Using fallback job suggestion after Gemini failure")
		writeJSON(w, http.StatusOK, suggestion)
		return
	}
	var suggestion jobSuggestion
	if err := json.Unmarshal([]byte(suggestionText), &suggestion); err != nil {
		log.Printf("Gemini returned invalid suggestion JSON: %v", err)
		suggestion = fallbackJobSuggestion()
		log.Printf("Using fallback job suggestion after JSON parsing failure")
	}
	if suggestion.Points < 10 || suggestion.Points > 500 {
		suggestion.Points = 50
	}
	if suggestion.Skills == nil {
		suggestion.Skills = []string{}
	}
	if suggestion.SubmissionFormats == nil {
		suggestion.SubmissionFormats = []string{}
	}
	if suggestion.Resources == nil {
		suggestion.Resources = []models.JobMaterial{}
	}
	writeJSON(w, http.StatusOK, suggestion)
}

func fallbackJobSuggestion() jobSuggestion {
	return jobSuggestion{
		Skills:            []string{"React", "TypeScript", "Tailwind CSS"},
		Points:            50,
		SubmissionFormats: []string{"GitHub Repository", "Live Deployment Link"},
		Resources: []models.JobMaterial{
			{Type: "doc", Label: "React Learn", URL: "https://react.dev/learn", Source: "link"},
			{Type: "doc", Label: "TypeScript Documentation", URL: "https://www.typescriptlang.org/docs/", Source: "link"},
			{Type: "doc", Label: "Tailwind CSS Documentation", URL: "https://tailwindcss.com/docs", Source: "link"},
		},
		Rationale: "Generated via fallback mechanism due to temporary AI response formatting error.",
	}
}

type createJobRequest struct {
	Title             string               `json:"title"`
	Category          string               `json:"category"`
	Description       string               `json:"description"`
	Skills            []string             `json:"skills"`
	Slots             int                  `json:"slots"`
	Deadline          string               `json:"deadline"`
	Reward            int                  `json:"reward"`
	Points            int                  `json:"points"`
	Difficulty        string               `json:"difficulty"`
	UseAI             bool                 `json:"useAI"`
	Materials         []models.JobMaterial `json:"materials"`
	SubmissionFormats []string             `json:"submissionFormats"`
}

// POST /api/jobs — only companies can post tasks. Company details come from the
// authenticated user's profile (not the request body) so they cannot be spoofed.
func (h *JobHandler) Create(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" || role != "company" {
		writeError(w, http.StatusForbidden, "only companies can post tasks")
		return
	}

	var req createJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" || req.Description == "" || req.Deadline == "" || req.Reward <= 0 {
		writeError(w, http.StatusBadRequest, "title, description, deadline and a positive reward are required")
		return
	}
	if req.Slots < 1 {
		req.Slots = 1
	}
	if req.Difficulty == "" {
		req.Difficulty = "Intermediate"
	}
	if req.Skills == nil {
		req.Skills = []string{}
	}
	if req.Materials == nil {
		req.Materials = []models.JobMaterial{}
	}
	if req.SubmissionFormats == nil {
		req.SubmissionFormats = []string{}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	company, err := h.users.FindByID(ctx, uid)
	if err != nil || company == nil {
		writeError(w, http.StatusUnauthorized, "company not found")
		return
	}
	name := ""
	if company.CompanyName != nil && *company.CompanyName != "" {
		name = *company.CompanyName
	} else {
		name = company.FirstName + " " + company.LastName
	}
	industry := ""
	if company.Industry != nil {
		industry = *company.Industry
	}

	job := &models.Job{
		CompanyID:         company.ID,
		CompanyName:       name,
		CompanyEmail:      company.Email,
		Industry:          industry,
		Title:             req.Title,
		Category:          req.Category,
		Description:       req.Description,
		Skills:            req.Skills,
		Slots:             req.Slots,
		Deadline:          req.Deadline,
		Reward:            req.Reward,
		Points:            req.Points,
		Difficulty:        req.Difficulty,
		UseAI:             req.UseAI,
		Materials:         req.Materials,
		SubmissionFormats: req.SubmissionFormats,
	}

	created, err := h.jobs.Create(ctx, job)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

// POST /api/jobs/{id}/book — validates worker skills and atomically reserves a slot.
func (h *JobHandler) Book(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == "" || middleware.GetUserRole(r) != "worker" {
		writeError(w, http.StatusForbidden, "only workers can book tasks")
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	worker, err := h.users.FindByID(ctx, uid)
	if err != nil || worker == nil {
		writeError(w, http.StatusUnauthorized, "worker not found")
		return
	}
	job, err := h.jobs.GetByID(ctx, id)
	if err != nil || job == nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	workerSkills := ""
	if worker.Skills != nil {
		workerSkills = *worker.Skills
	}
	missing := missingSkills(job.Skills, workerSkills)
	if len(missing) > 0 {
		writeError(w, http.StatusBadRequest, "booking rejected: missing required skill(s): "+strings.Join(missing, ", "))
		return
	}
	booked, err := h.jobs.Book(ctx, id, worker.ID)
	if err != nil {
		if strings.Contains(err.Error(), "already booked") || strings.Contains(err.Error(), "no slots") {
			writeError(w, http.StatusConflict, err.Error())
		} else {
			writeError(w, http.StatusInternalServerError, "failed to reserve task slot")
		}
		return
	}
	writeJSON(w, http.StatusCreated, booked)
}

// GET /api/jobs/booked — returns the authenticated worker's database-backed bookings.
func (h *JobHandler) Booked(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == "" || middleware.GetUserRole(r) != "worker" {
		writeError(w, http.StatusForbidden, "only workers can access bookings")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	ids, err := h.jobs.ListBookedForWorker(ctx, uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch bookings")
		return
	}
	if ids == nil {
		ids = []int{}
	}
	writeJSON(w, http.StatusOK, ids)
}

// GET /api/jobs — returns every task with its posting company's details.
func (h *JobHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	jobs, err := h.jobs.ListAll(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch tasks")
		return
	}
	if jobs == nil {
		jobs = []models.Job{}
	}
	writeJSON(w, http.StatusOK, jobs)
}

// PATCH /api/jobs/{id} — meta edits/status require the owning company;
// booking/submission deltas are allowed for any authenticated user.
func (h *JobHandler) Patch(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	var p models.JobPatch
	_ = json.NewDecoder(r.Body).Decode(&p)

	metaEdit := p.Title != nil || p.Reward != nil || p.Deadline != nil || p.Status != nil || p.Materials != nil || p.SubmissionFormats != nil

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if metaEdit {
		if role != "company" {
			writeError(w, http.StatusForbidden, "only companies can edit their tasks")
			return
		}
		existing, err := h.jobs.GetByID(ctx, id)
		if err != nil || existing == nil {
			writeError(w, http.StatusNotFound, "task not found")
			return
		}
		company, err := h.users.FindByID(ctx, uid)
		if err != nil || company == nil || company.Email != existing.CompanyEmail {
			writeError(w, http.StatusForbidden, "you can only edit your own tasks")
			return
		}
	}

	updated, err := h.jobs.Patch(ctx, id, p)
	if err != nil || updated == nil {
		writeError(w, http.StatusInternalServerError, "failed to update task")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// DELETE /api/jobs/{id} — company permanently deletes their own task (and all its submissions via CASCADE).
func (h *JobHandler) Delete(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	role := middleware.GetUserRole(r)
	if uid == "" || role != "company" {
		writeError(w, http.StatusForbidden, "only companies can delete tasks")
		return
	}

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	existing, err := h.jobs.GetByID(ctx, id)
	if err != nil || existing == nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	company, err := h.users.FindByID(ctx, uid)
	if err != nil || company == nil || company.Email != existing.CompanyEmail {
		writeError(w, http.StatusForbidden, "you can only delete your own tasks")
		return
	}

	if err := h.jobs.Delete(ctx, id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Task deleted."})
}
