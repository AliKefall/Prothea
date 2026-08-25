CREATE TABLE IF NOT EXISTS friendships (
    user_id UUID NOT NULL,
    friend_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY(user_id, friend_id),

    FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY(friend_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CHECK (user_id < friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
    requester_id UUID NOT NULL,
    target_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (requester_id, target_id),

    FOREIGN KEY (requester_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (target_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CHECK (requester_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_friendship_friend_id
ON friendships(friend_id);

CREATE INDEX IF NOT EXISTS idx_friend_requests_target_id
ON friend_requests(target_id);
