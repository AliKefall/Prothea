CREATE TABLE rating_history(
    id BIGSERIAL PRIMARY KEY,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    match_id UUID NOT NULL
        REFERENCES matches(id)
        ON DELETE CASCADE,

    rating_type rating_type NOT NULL,

    old_rating DOUBLE PRECISION NOT NULL,
    new_rating DOUBLE PRECISION NOT NULL,

    old_rd DOUBLE PRECISION NOT NULL,
    new_rd DOUBLE PRECISION NOT NULL,

    old_volatility DOUBLE PRECISION NOT NULL,
    new_volatility DOUBLE PRECISION NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT rating_history_unique_match
        UNIQUE(user_id, match_id, rating_type)
);

CREATE INDEX idx_rating_history_user
    ON rating_history (user_id, created_at DESC);

CREATE INDEX idx_rating_history_match
    ON rating_history (match_id);
