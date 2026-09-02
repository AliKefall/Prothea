-- name: CreateMatchMove :one
INSERT INTO match_moves (
    match_id,
    move_number,
    player_id,
    san,
    uci,
    fen_after,
    white_time_ms,
    black_time_ms
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
)
RETURNING
    id,
    match_id,
    move_number,
    player_id,
    san,
    uci,
    fen_after,
    white_time_ms,
    black_time_ms,
    created_at;


-- name: GetMatchMoves :many
SELECT
    id,
    match_id,
    move_number,
    player_id,
    san,
    uci,
    fen_after,
    white_time_ms,
    black_time_ms,
    created_at
FROM match_moves
WHERE match_id = $1
ORDER BY move_number ASC;


-- name: GetLastMatchMove :one
SELECT
    id,
    match_id,
    move_number,
    player_id,
    san,
    uci,
    fen_after,
    white_time_ms,
    black_time_ms,
    created_at
FROM match_moves
WHERE match_id = $1
ORDER BY move_number DESC
LIMIT 1;


-- name: GetMatchMove :one
SELECT
    id,
    match_id,
    move_number,
    player_id,
    san,
    uci,
    fen_after,
    white_time_ms,
    black_time_ms,
    created_at
FROM match_moves
WHERE match_id = $1
  AND move_number = $2;


