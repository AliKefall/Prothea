package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/AliKefall/prothea/internal/matchmaking"
	"github.com/joho/godotenv"
)

// NOTE: Write a decent bootstrap for services.
// Also write more readeble code for the f sake
func main() {
	godotenv.Load()

	config := NewServer()

	conn, deps := bootstrapServer(config)
	defer conn.Close()
	defer deps.redis.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// WebSocket hub
	go deps.hub.Run(ctx)

	// Matchmaking worker
	matchmakingWorker := &matchmaking.Worker{
		Hub:          deps.hub,
		TimeControls: matchmaking.SupportedTimeControls,
		PollInterval: matchmaking.DefaultPollInterval,
		BatchSize:    matchmaking.DefaultMatchBatchSize,
	}

	go matchmakingWorker.Run(
		ctx,
		deps.deps.Matchmaking,
	)

	server := &http.Server{
		Addr:              ":" + config.Port,
		Handler:           newRouter(config, deps.deps),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("server listening on %s", server.Addr)

		if err := server.ListenAndServe(); err != nil &&
			err != http.ErrServerClosed {
			log.Fatalf("server failed: %v", err)
		}
	}()

	serverShutdown(server)

	cancel()
}
func serverShutdown(srv *http.Server) {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop // This channel only works if it is in the main function

	log.Println("Shutting down the server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)

		_ = srv.Close()
	}

	signal.Stop(stop)
	log.Println("Server stopped cleanly")
}
