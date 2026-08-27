package auth

import (
	"errors"
	"net/http"
	"strings"
)


func GetBearer(header http.Header) (string, error){
	authHeader := strings.TrimSpace(header.Get("Authorization"))
	if authHeader == ""{
		return "", errors.New("Authorization header not found")
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 {
		return "", errors.New("Invalid authorization header")
	}
	if strings.ToLower(parts[0]) != "bearer"{
		return "", errors.New("Invalid authorization scheme")
	}
	token := strings.TrimSpace(parts[1])
	if token == ""{
		return "", errors.New("bearer token not found")
	}

	return token, nil
}
