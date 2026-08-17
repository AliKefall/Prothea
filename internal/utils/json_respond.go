package utils

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
)

type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"request_id,omitempty"`
}

const DefaultMaxBodySize int64 = 2 << 20 // 2mb

func RespondWithJSON(
	w http.ResponseWriter,
	status int,
	payload any,
) {
	body, err := json.Marshal(payload)
	if err != nil {
		slog.Error(
			"failed to marshal response",
			"error", err,
		)

		body = []byte(`{
			 "error":{
				 "code":"internal_server_error",
				 "message":"Internal server error"
			 }
		 }`)
		status = http.StatusInternalServerError
	}

	w.Header().Set("Content-Type", "application/json; charset-utf8")
	w.WriteHeader(status)

	if _, err := w.Write(body); err != nil {
		slog.Error(
			"failed to write response",
			"error", err,
		)
	}
}

func RespondWithError(
	w http.ResponseWriter,
	status int,
	code string,
	message string,
	requestID string,
	err error,
) {
	if err != nil {
		slog.Error("request failed",
			"status", status,
			"code", code,
			"error", err,
			"request_id", requestID,
		)
	}
	resp := ErrorResponse{
		Error: ErrorBody{
			Code:      code,
			Message:   message,
			RequestID: requestID,
		},
	}

	RespondWithJSON(w, status, resp)
}

// DecodeJSON decodes a single JSON object into dst.
func DecodeJSON(
	w http.ResponseWriter,
	r *http.Request,
	dst any,
) error {

	if r.Body == nil {
		return errors.New("request body is empty")
	}

	contentType := r.Header.Get("Content-Type")
	if contentType != "" {

		mediaType, _, err := mime.ParseMediaType(contentType)
		if err != nil {
			return err
		}

		if mediaType != "application/json" {
			return errors.New("content type must be application/json")
		}
	}

	r.Body = http.MaxBytesReader(
		w,
		r.Body,
		DefaultMaxBodySize,
	)

	defer r.Body.Close()

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {

		if errors.Is(err, io.EOF) {
			return errors.New("request body is empty")
		}

		return err
	}

	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return errors.New("request body must contain only one JSON object")
	}

	return nil
}

// EncodeJSON writes payload as JSON.
func EncodeJSON(
	w http.ResponseWriter,
	status int,
	payload any,
) error {

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)

	return encoder.Encode(payload)
}
