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

func bootstrapServer(config *ServerConfig) (*sql.DB, serverDependencies) {
	conn := mustOpenDatabase(config)
	queries := database.New(conn)

	redisClient := NewRedisClient(config.RedisURL)

	hub := websocket.NewHub()
	chatService := configureChat(conn, queries, hub)
	matchmakingService := configureMatchmaking(redisClient)
	gameService := configureGame(conn, queries, redisClient)
	friendsService := configureFriends(conn, queries, hub)
	configureGameEvents(hub, gameService)
	configureUserLifecycle(hub, gameService, friendsService)

	deps := &endpoints.Deps{
		DB:                conn,
		Queries:           queries,
		RedisClient:       redisClient,
		LoginSessionStore: redisClient,
		Hasher:            auth.NewPasswordHasher(),
		JWT:               auth.NewJWTManager(config.JWTSecret, 15*time.Minute),
		Friends:           friendsService,
		Matchmaking:       matchmakingService,
		Hub:               hub,
		Chat:              chatService,
		Game:              gameService,
	}

	return conn, serverDependencies{
		deps:    deps,
		queries: queries,
		hub:     hub,
		redis:   redisClient,
	}
}

func configureChat(conn *sql.DB, queries *database.Queries, hub *websocket.Hub) *chat.Service {
	service := chat.NewService(conn, queries, hub)
	hub.Register(websocket.EventChatSend, service.HandleSendMessage)
	return service
}

func configureMatchmaking(redisClient *redis.Client) *matchmaking.Service {
	return matchmaking.NewMatchmakingService(redisClient)
}

func configureGame(
	conn *sql.DB,
	queries *database.Queries,
	redisClient *redis.Client,
) *game.Service {
	stateStore := game.NewRedisStateStore(redisClient)
	disconnectStore := game.NewRedisDisconnectStore(redisClient)
	gameLock := game.NewRedisGameLock(redisClient)
	ratingService := elo.NewService(elo.NewRepository(conn, queries))

	gameService := game.NewService(
		conn,
		queries,
		stateStore,
		disconnectStore,
		game.NewChessValidator(),
		gameLock,
		ratingService,
	)
	return gameService
}

func configureFriends(conn *sql.DB, queries *database.Queries, hub *websocket.Hub) *friends.Service {
	return friends.NewService(conn, queries, hub)
}

func configureUserLifecycle(hub *websocket.Hub, gameService *game.Service, friendsService *friends.Service) {
	hub.SetUserLifecycleHandler(
		func(client *websocket.Client) {
			gameService.HandleUserConnected(client)
			friendsService.HandleUserConnected(client)
		},
		func(client *websocket.Client) {
			gameService.HandleUserDisconnected(client)
			friendsService.HandleUserDisconnected(client)
		},
	)
}

func configureGameEvents(hub *websocket.Hub, service *game.Service) {
	hub.Register(websocket.EventGameMove, service.HandleMove)
	hub.Register(websocket.EventGameResign, service.HandlerResign)
	hub.Register(websocket.EventGameDrawOffer, service.HandleDrawOffer)
	hub.Register(websocket.EventGameDrawReject, service.HandleDrawDecline)
	hub.Register(websocket.EventGameDrawAccept, service.HandleDrawAccept)
	hub.Register(websocket.EventGamePresenceSyncRequest, service.HandlePresenceSync)
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
