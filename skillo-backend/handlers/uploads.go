package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/skillo/backend/middleware"
)

const (
	maxUploadSize = 25 << 20
	uploadDir     = "uploads"
)

type UploadHandler struct{}

type uploadResponse struct {
	URL      string `json:"url"`
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
}

// Create accepts an authenticated multipart upload and stores it with a
// generated name so client-provided paths cannot escape the upload directory.
func (h *UploadHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.GetUserID(r) == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if r.ContentLength > maxUploadSize+1<<20 {
		writeError(w, http.StatusRequestEntityTooLarge, "file is too large; maximum size is 25 MB")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize+1<<20)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "invalid multipart upload")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()
	if header.Size > maxUploadSize {
		writeError(w, http.StatusRequestEntityTooLarge, "file is too large; maximum size is 25 MB")
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if len(ext) > 10 || strings.ContainsAny(ext, `/\`) {
		ext = ""
	}
	randomName, err := randomFilename()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create upload name")
		return
	}
	if err := os.MkdirAll(uploadDir, 0750); err != nil {
		writeError(w, http.StatusInternalServerError, "could not prepare upload storage")
		return
	}

	name := randomName + ext
	path := filepath.Join(uploadDir, name)
	dst, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save upload")
		return
	}
	defer dst.Close()

	limited := io.LimitReader(file, maxUploadSize+1)
	written, err := io.Copy(dst, limited)
	if err != nil || written > maxUploadSize {
		_ = os.Remove(path)
		if written > maxUploadSize {
			writeError(w, http.StatusRequestEntityTooLarge, "file is too large; maximum size is 25 MB")
		} else {
			writeError(w, http.StatusInternalServerError, "could not save upload")
		}
		return
	}

	writeJSON(w, http.StatusCreated, uploadResponse{
		URL:      "/uploads/" + name,
		Name:     header.Filename,
		Size:     written,
		MimeType: header.Header.Get("Content-Type"),
	})
}

func randomFilename() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate upload name: %w", err)
	}
	return hex.EncodeToString(b[:]), nil
}
