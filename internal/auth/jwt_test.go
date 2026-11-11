package auth

import (
	"testing"
	"time"
)

func TestJWTManagerGenerateAndVerify(t *testing.T) {
	manager, err := NewJWTManager("01234567890123456789012345678901", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	token, err := manager.Generate("user-id", "session-id")
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	claims, err := manager.Verify(token)
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if claims.UserID != "user-id" || claims.SessionID != "session-id" {
		t.Fatalf("unexpected claims: user=%q session=%q", claims.UserID, claims.SessionID)
	}
}

func TestJWTManagerRejectsInvalidToken(t *testing.T) {
	manager, err := NewJWTManager("01234567890123456789012345678901", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Verify("invalid.token.value"); err == nil {
		t.Fatal("Verify() accepted an invalid token")
	}
}

func TestPasswordHasherHashAndVerify(t *testing.T) {
	hasher := NewPasswordHasher()
	encoded, err := hasher.Hash("Correct!Horse9")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	valid, err := hasher.Verify("Correct!Horse9", encoded)
	if err != nil || !valid {
		t.Fatalf("Verify(correct) = %v, %v", valid, err)
	}
	valid, err = hasher.Verify("wrong password", encoded)
	if err != nil || valid {
		t.Fatalf("Verify(wrong) = %v, %v", valid, err)
	}
}
