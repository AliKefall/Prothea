package main

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/chat"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/elo"
	"github.com/AliKefall/prothea/internal/endpoints"
	"github.com/AliKefall/prothea/internal/friends"
	"github.com/AliKefall/prothea/internal/game"
	"github.com/AliKefall/prothea/internal/matchmaking"
	"github.com/AliKefall/prothea/internal/websocket"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/redis/go-redis/v9"
)

type serverDependencies struct {
	deps    *endpoints.Deps
	queries *database.Queries
	hub     *websocket.Hub
	redis   *redis.Client
}

//NOTE: Tidy up this place

func bootstrapServer(config *ServerConfig) (*sql.DB, serverDependencies) {
	conn := mustOpenDatabase(config)
	queries := database.New(conn)

	redisClient := NewRedisClient(config.RedisURL)

	hub := websocket.NewHub()

	chatService := chat.NewService(conn, queries, hub)
	hub.Register(
		websocket.EventChatSend,
		chatService.HandleSendMessage,
	)

	matchmakingService := matchmaking.NewMatchmakingService(redisClient)

	gameStateStore := game.NewRedisStateStore(redisClient)
	gameLock := game.NewRedisGameLock(redisClient)

	eloRepository := elo.NewRepository(conn, queries)

	eloService := elo.NewService(eloRepository)
	gameService := game.NewService(
		conn,
		queries,
		gameStateStore,
		game.NewChessValidator(),
		gameLock,
		eloService,
	)

	hub.Register(
		websocket.EventGameMove,
		gameService.HandleMove,
	)

	hub.Register(
		websocket.EventGameResign,
		gameService.HandlerResign,
	)

	hub.Register(
		websocket.EventGameDrawOffer,
		gameService.HandleDrawOffer,
	)

	hub.Register(
		websocket.EventGameDrawReject,
		gameService.HandleDrawDecline,
	)

	hub.Register(
		websocket.EventGameDrawAccept,
		gameService.HandleDrawAccept,
	)

	deps := &endpoints.Deps{
		DB:          conn,
		Queries:     queries,
		RedisClient: redisClient,
		Hasher:      auth.NewPasswordHasher(),
		JWT:         auth.NewJWTManager(config.JWTSecret, 15*time.Minute),
		Friends:     friends.NewService(conn, queries, hub),
		Matchmaking: matchmakingService,
		Hub:         hub,
		Chat:        chatService,
		Game:        gameService,
	}

	return conn, serverDependencies{
		deps:    deps,
		queries: queries,
		hub:     hub,
		redis:   redisClient,
	}
}

func mustOpenDatabase(config *ServerConfig) *sql.DB {
	dbURL := config.DBUrl
	if dbURL == "" {
		log.Fatal("database url is required")
	}

	conn, err := sql.Open("pgx", dbURL)
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
