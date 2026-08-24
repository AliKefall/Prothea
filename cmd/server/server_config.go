package main

import (
	"os"
	"strings"
)

type ServerConfig struct{
	DBUrl string
	JWTSecret string
	Port string
	AllowedOrigins []string
	RedisURL string
}

func NewServer() *ServerConfig{
	allowedOrigins := []string {
		"http://localhost:3000",
		"http://192.168.1.12:3000",
	}

	if value := os.Getenv("CORS_ALLOWED_ORIGINS"); value != ""{
		parts := strings.Split(value, ",")
		allowedOrigins = make([]string, 0, len(parts))
		for _, origin := range parts {
			allowedOrigins = append(allowedOrigins, origin)
		}

	}

	return &ServerConfig{
		DBUrl: os.Getenv("DATABASE_URL"),
		JWTSecret: os.Getenv("JWT_SECRET"),
		Port: os.Getenv("PORT"),
		AllowedOrigins: allowedOrigins,
		RedisURL: os.Getenv("REDIS_URL"),
	}
}
