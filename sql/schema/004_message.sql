CREATE TYPE conversation_type AS ENUM (
    'direct',
    'group'
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    type conversation_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (conversation_id, user_id)
);


CREATE TABLE messages (
    id UUID PRIMARY KEY ,

    conversation_id UUID NOT NULL
    REFERENCES conversations(id) ON DELETE CASCADE,

    sender_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    edited_at TIMESTAMPTZ,

    deleted_at TIMESTAMPTZ
);
