export interface Friend{
    id: string;
    username: string;

    online: boolean;

    inGame: boolean;

    lastSeen?: string;
}

export interface FriendRequest {
    id: string;
    username: string;
}

export interface FriendsState{
    friends: Friend[];

    incomingRequests: FriendRequest[];

    outgoingRequests: FriendRequest[];
}
