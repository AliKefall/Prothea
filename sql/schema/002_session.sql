CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,

    user_agent TEXT,
    ip_address TEXT,

    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,

    max_expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ
);

