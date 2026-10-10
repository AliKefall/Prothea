package websocket

import (
	"testing"
	"time"
)

func TestHubPresenceLifecycleTracksLastConnection(t *testing.T) {
	hub := NewHub()
	online := make(chan string, 2)
	offline := make(chan string, 2)
	hub.SetUserLifecycleHandler(func(c *Client) { online <- c.UserID }, func(c *Client) { offline <- c.UserID })

	first := &Client{UserID: "user-1"}
	second := &Client{UserID: "user-1"}
	hub.registerClient(first)
	if got := receivePresence(t, online); got != "user-1" {
		t.Fatalf("online user = %q", got)
	}
	hub.registerClient(second)
	assertNoPresence(t, online)

	if !hub.IsUserConnected("user-1") {
		t.Fatal("user should be connected")
	}
	hub.unregisterClient(first)
	assertNoPresence(t, offline)
	hub.unregisterClient(second)
	if got := receivePresence(t, offline); got != "user-1" {
		t.Fatalf("offline user = %q", got)
	}
	if hub.IsUserConnected("user-1") {
		t.Fatal("user should be disconnected")
	}
}

func receivePresence(t *testing.T, events <-chan string) string {
	t.Helper()
	select {
	case userID := <-events:
		return userID
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for presence event")
		return ""
	}
}

func assertNoPresence(t *testing.T, events <-chan string) {
	t.Helper()
	select {
	case userID := <-events:
		t.Fatalf("unexpected presence event for %q", userID)
	case <-time.After(20 * time.Millisecond):
	}
}
