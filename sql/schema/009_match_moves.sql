CREATE TABLE match_moves (
    id BIGSERIAL PRIMARY KEY,

    match_id UUID NOT NULL
        REFERENCES matches(id)
        ON DELETE CASCADE,

    move_number INT NOT NULL,

    player_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    san TEXT NOT NULL,

    uci TEXT NOT NULL,

    fen_after TEXT NOT NULL,

    white_time_ms BIGINT NOT NULL,

    black_time_ms BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT match_moves_move_number_positive
        CHECK (move_number > 0),

    CONSTRAINT match_moves_white_time_valid
        CHECK (white_time_ms >= 0),

    CONSTRAINT match_moves_black_time_valid
        CHECK (black_time_ms >= 0),

    CONSTRAINT match_moves_san_not_empty
        CHECK (btrim(san) <> ''),

    CONSTRAINT match_moves_uci_not_empty
        CHECK (btrim(uci) <> ''),

    CONSTRAINT match_moves_fen_not_empty
        CHECK (btrim(fen_after) <> ''),

    UNIQUE (match_id, move_number)
);
