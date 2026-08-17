package chat

import "time"

type ChatMessage struct {
	ID        string    `json:"string"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"time_stamp"`
}

