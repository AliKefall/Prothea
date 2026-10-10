package utils

import (
	"net/http/httptest"
	"testing"
)

func TestGetClientIP(t *testing.T) {
	tests := []struct{ name, forwarded, real, remote, want string }{
		{name: "forwarded chain", forwarded: " 203.0.113.4, 10.0.0.1", remote: "127.0.0.1:1234", want: "203.0.113.4"},
		{name: "real ip", real: "203.0.113.5", remote: "127.0.0.1:1234", want: "203.0.113.5"},
		{name: "remote address", remote: "[::1]:1234", want: "::1"},
		{name: "raw remote address", remote: "client", want: "client"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.Header.Set("X-Forwarded-For", tt.forwarded)
			r.Header.Set("X-Real-IP", tt.real)
			r.RemoteAddr = tt.remote
			if got := GetClientIP(r); got != tt.want {
				t.Fatalf("GetClientIP() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestShouldUseSecureCookie(t *testing.T) {
	r := httptest.NewRequest("GET", "http://example.com", nil)
	if ShouldUseSecureCookie(r) {
		t.Fatal("plain HTTP request should not use Secure cookie")
	}
	r.Header.Set("X-Forwarded-Proto", "HTTPS")
	if !ShouldUseSecureCookie(r) {
		t.Fatal("forwarded HTTPS request should use Secure cookie")
	}
}
