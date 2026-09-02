CREATE TYPE match_result AS ENUM (
    'pending',
    'white',
    'black',
    'draw',
    'abandoned'
);

CREATE TABLE matches (
    id UUID PRIMARY KEY,

    white_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    black_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    time_control TEXT NOT NULL,

    white_rating_before INT NOT NULL,
    black_rating_before INT NOT NULL,

    white_rating_after INT,
    black_rating_after INT,

    result match_result NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    finished_at TIMESTAMPTZ,

    CONSTRAINT matches_different_players
        CHECK (white_id <> black_id),

    CONSTRAINT matches_time_control_not_empty
        CHECK (btrim(time_control) <> ''),

    CONSTRAINT matches_white_rating_before_valid
        CHECK (white_rating_before >= 0),

    CONSTRAINT matches_black_rating_before_valid
        CHECK (black_rating_before >= 0),

    CONSTRAINT matches_white_rating_after_valid
        CHECK (
            white_rating_after IS NULL
            OR white_rating_after >= 0
        ),

    CONSTRAINT matches_black_rating_after_valid
        CHECK (
            black_rating_after IS NULL
            OR black_rating_after >= 0
        ),

    CONSTRAINT matches_finish_state_consistent
        CHECK (
            (
                result = 'pending'
                AND finished_at IS NULL
            )
            OR
            (
                result <> 'pending'
                AND finished_at IS NOT NULL
            )
        )
);

CREATE INDEX idx_matches_white_player
    ON matches (white_id, created_at DESC);

CREATE INDEX idx_matches_black_player
    ON matches (black_id, created_at DESC);

CREATE INDEX idx_matches_result
    ON matches (result, created_at DESC);
