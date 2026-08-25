package chat

type SendMessageInput struct {
	RecipientID string `json:"recipient_id"`
	Content     string `json:"content"`
}

type MessagePayload struct {
	MessageID      string `json:"message_id"`
	SenderID       string `json:"sender_id"`
	SenderUsername string `json:"sender_username"`
	RecipientID    string `json:"recipient_id"`
	Content        string `json:"content"`
}
