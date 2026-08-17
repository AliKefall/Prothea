package utils

import (
	"net/http"
	"strings"
)

func ShouldUseSecureCookie(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https"){
		return true
	}
	return false
}
