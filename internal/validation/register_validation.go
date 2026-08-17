package validation

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrInvalidEmail    = errors.New("Invalid email")
	ErrInvalidUsername = errors.New("invalid username")
	ErrWeakPassword    = errors.New("weak password")
)

func ValidateRegister(email, username, password string) error {
	email = NormalizeEmail(email)

	if !IsValidEmail(email) {
		return ErrInvalidEmail
	}

	if !IsValidUsername(username) {
		return ErrInvalidUsername
	}

	if IsCommonPassword(password) {
		return ErrWeakPassword
	}

	if !IsValidPassword(password) {
		return ErrWeakPassword
	}

	return nil
}

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func IsValidEmail(email string) bool {
	if len(email) < 5 || len(email) > 254 {
		return false
	}

	at := false
	dot := false

	for _, r := range email {
		if r == '@' {
			at = true
		}
		if r == '.' && at {
			dot = true
		}
	}
	return at && dot
}

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*$`)

func IsValidUsername(username string) bool {
	if len(username) < 3 || len(username) > 32 {
		return false
	}
	return usernameRegex.MatchString(username)
}

func IsCommonPassword(pw string) bool {
	switch pw {
	case "password", "123456", "12345678", "qwerty":
		return true
	default:
		return false
	}
}

func IsValidPassword(password string) bool {
	if len(password) < 8 || len(password) > 128 {
		return false
	}

	var (
		hasLower   bool
		hasUpper   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, r := range password {
		switch {
		case r >= 'a' && r <= 'z':
			hasLower = true
		case r >= 'A' && r <= 'Z':
			hasUpper = true
		case r >= '0' && r <= '9':
			hasNumber = true
		case r == ' ':
			return false
		default:
			hasSpecial = true
		}
	}

	return hasLower && hasUpper && hasNumber && hasSpecial
}
