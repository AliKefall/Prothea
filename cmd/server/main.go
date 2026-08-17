package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {



}

func serverShutdown(srv *http.Server){
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop // This channel only works if it is in the main function

	log.Println("Shutting down the server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5 * time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)

		_ = srv.Close()
	}

	signal.Stop(stop)
	log.Println("Server stopped cleanly")
}
