package auth

import (
	"errors"
	"net/http"
	"strings"
)

func GetBearer(r *http.Request) (string, error){
	header:= r.Header.Get("Authorization")
	if header  == "" {
		return "", errors.New("Authorization header not found")
	}

	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 {
		return "", errors.New("Invalid authorization header")
	}

	if strings.TrimSpace(strings.ToLower(parts[0])) != "bearer "{
		return "", errors.New("Invalid authorization scheme")
	}
	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", errors.New("bearer token not found")
	}

	return token, nil
}
