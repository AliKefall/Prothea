package main

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/AliKefall/prothea/internal/chat"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/endpoints"
	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/redis/go-redis/v9"
)

type serverDependencies struct {
	deps    *endpoints.Deps
	queries *database.Queries
	hub     *websocket.Hub
	redis   *redis.Client
}

func bootstrapServer(config *ServerConfig) (*sql.DB, serverDependencies) {
	conn := mustOpenDatabase(config)
	queries := database.New(conn)

	redisClient := NewRedisClient(config.RedisURL)

	chatService := chat.NewService(conn, queries)

}


func mustOpenDatabase(config *ServerConfig) *sql.DB {
	dbUrl := config.DBUrl

	conn, err := sql.Open("pgx", dbUrl)
	if err != nil {
		log.Fatalf("database connection error: %v", err)
	}

	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(25)
	conn.SetConnMaxLifetime(5 * time.Minute)
	if err := conn.Ping(); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	return conn

}

func NewRedisClient(redisURL string) *redis.Client {

	var opt *redis.Options
	var err error

	if redisURL != "" {
		opt, err = redis.ParseURL(redisURL)
		if err != nil {
			log.Fatalf("invalid REDIS_URL: %v", err)
		}
	} else {
		opt = &redis.Options{
			Addr:         "localhost:6379",
			Password:     "",
			DB:           0,
			PoolSize:     10,
			MaxIdleConns: 5,
		}
	}

	rdb := redis.NewClient(opt)

	// optional but recommended: early fail
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis connection failed: %v", err)
	}

	return rdb
}
