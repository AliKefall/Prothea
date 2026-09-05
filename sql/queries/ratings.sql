-- name: CreatePlayerRatings :exec
INSERT INTO player_ratings (
    user_id,
    rating_type,
    rating,
    rd,
    volatility,
    games_played
)
VALUES
    ($1, 'bullet', 1500.0, 350.0, 0.06, 0),
    ($1, 'blitz',  1500.0, 350.0, 0.06, 0),
    ($1, 'rapid',  1500.0, 350.0, 0.06, 0);

-- name: GetPlayerRating :one
SELECT
    user_id,
    rating_type,
    rating,
    rd,
    volatility,
    games_played,
    created_at,
    updated_at
FROM player_ratings
WHERE user_id = $1
    AND rating_type = $2;

-- name: GetPlayerRatings :many
SELECT
    user_id,
    rating_type,
    rating,
    rd,
    volatility,
    games_played,
    created_at,
    updated_at
FROM player_ratings
WHERE user_id = $1
ORDER BY rating_type;

-- name: UpdatePlayerRating :one
UPDATE player_ratings
SET
    rating = $3,
    rd = $4,
    volatility = $5,
    games_played = $6,
    updated_at = NOW()
WHERE user_id = $1
    AND rating_type = $2
RETURNING
    user_id,
    rating_type,
    rating,
    rd,
    volatility,
    games_played,
    created_at,
    updated_at;

-- name: GetPlayerRatingHistory :many
SELECT
    id,
    user_id,
    match_id,
    rating_type,
    old_rating,
    new_rating,
    old_rd,
    new_rd,
    old_volatility,
    new_volatility,
    created_at
FROM rating_history
WHERE user_id = $1
  AND rating_type = $2
ORDER BY created_at DESC
LIMIT $3
OFFSET $4;


-- name: GetMatchRatingHistory :many
SELECT
    id,
    user_id,
    match_id,
    rating_type,
    old_rating,
    new_rating,
    old_rd,
    new_rd,
    old_volatility,
    new_volatility,
    created_at
FROM rating_history
WHERE match_id = $1
ORDER BY user_id, rating_type;

-- name: CreateRatingHistory :exec
INSERT INTO rating_history (
    user_id,
    match_id,
    rating_type,
    old_rating,
    new_rating,
    old_rd,
    new_rd,
    old_volatility,
    new_volatility
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
);
