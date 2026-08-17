CREATE TYPE rating_type AS ENUM (
    'bullet',
    'blitz',
    'rapid'
);

CREATE TABLE player_ratings(
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    rating_type rating_type NOT NULL,

    rating DOUBLE PRECISION NOT NULL DEFAULT 1500.0,

    rd DOUBLE PRECISION NOT NULL DEFAULT 350.0,

    volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06,

    games_played INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, rating_type),

    CONSTRAINT player_ratings_rating_range
        CHECK (rating >= 100.0 AND rating <= 4000.0),

    CONSTRAINT player_ratings_rd_range
        CHECK(rd >= 30.0 AND rd <= 350.0),

    CONSTRAINT player_ratings_volatility_positive
        CHECK (volatility > 0.0),

    CONSTRAINT player_ratings_games_played_positive
        CHECK(games_played >= 0)

);

CREATE INDEX idx_player_ratings_type_rating
    ON player_ratings (rating_type, rating DESC);
