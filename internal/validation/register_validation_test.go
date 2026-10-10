package validation

import (
	"errors"
	"testing"
)

func TestValidateRegister(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		username string
		password string
		wantErr  error
	}{
		{name: "valid", email: " User@Example.com ", username: "player_1", password: "Strong!123"},
		{name: "invalid email", email: "user", username: "player", password: "Strong!123", wantErr: ErrInvalidEmail},
		{name: "invalid username", email: "user@example.com", username: "bad-name", password: "Strong!123", wantErr: ErrInvalidUsername},
		{name: "common password", email: "user@example.com", username: "player", password: "password", wantErr: ErrWeakPassword},
		{name: "weak password", email: "user@example.com", username: "player", password: "alllowercase", wantErr: ErrWeakPassword},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRegister(tt.email, tt.username, tt.password)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("ValidateRegister() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestNormalizeEmail(t *testing.T) {
	if got := NormalizeEmail("  PLAYER@Example.COM "); got != "player@example.com" {
		t.Fatalf("NormalizeEmail() = %q", got)
	}
}
