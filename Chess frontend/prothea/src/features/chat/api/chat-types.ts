export interface SendMessageInput{
    recipient_id: string;
    content: string;
}

export interface MessagePayload {
    message_id: string;
    sender_id: string;
    sender_username: string;
    recipient_id: string;
    content: string;
}
