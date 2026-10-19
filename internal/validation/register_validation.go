package validation

import (
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	ErrInvalidEmail    = errors.New("Enter a valid email address")
	ErrInvalidUsername = errors.New("Username must be 3–32 characters and use letters, numbers, or single underscores between them")
	ErrWeakPassword    = errors.New("Password must be 8–128 characters, include lowercase and uppercase letters, a number, and a symbol, contain no spaces, and not be commonly used")
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
	address, err := mail.ParseAddress(email)
	separator := strings.LastIndexByte(email, '@')
	lastDot := strings.LastIndexByte(email, '.')
	return err == nil && address.Address == email && lastDot > separator+1 && len(email)-lastDot-1 >= 2
}

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9]+(_[a-zA-Z0-9]+)*$`)

func IsValidUsername(username string) bool {
	if len(username) < 3 || len(username) > 32 {
		return false
	}
	return usernameRegex.MatchString(username)
}

func IsCommonPassword(pw string) bool {
	switch strings.ToLower(pw) {
	case "password", "123456", "12345678", "qwerty":
		return true
	default:
		return false
	}
}

func IsValidPassword(password string) bool {
	if utf8.RuneCountInString(password) < 8 || utf8.RuneCountInString(password) > 128 {
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
		case unicode.IsSpace(r):
			return false
		default:
			hasSpecial = true
		}
	}

	return hasLower && hasUpper && hasNumber && hasSpecial
}
