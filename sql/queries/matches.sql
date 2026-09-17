-- name: CreateMatch :one
INSERT INTO matches (
    id,
    white_id,
    black_id,
    time_control,
    white_rating_before,
    black_rating_before,
    result
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    'pending'
)
RETURNING
    id,
    white_id,
    black_id,
    time_control,
    white_rating_before,
    black_rating_before,
    white_rating_after,
    black_rating_after,
    result,
    created_at,
    finished_at;


-- name: GetMatch :one
SELECT
    id,
    white_id,
    black_id,
    time_control,
    white_rating_before,
    black_rating_before,
    white_rating_after,
    black_rating_after,
    result,
    created_at,
    finished_at
FROM matches
WHERE id = $1;


-- name: GetActiveMatchForPlayer :one
SELECT
    id,
    white_id,
    black_id,
    time_control,
    white_rating_before,
    black_rating_before,
    white_rating_after,
    black_rating_after,
    result,
    created_at,
    finished_at
FROM matches
WHERE result = 'pending'
  AND (
      white_id = $1
      OR black_id = $1
  )
ORDER BY created_at DESC
LIMIT 1;


-- name: FinishMatch :one
UPDATE matches
SET
    result = $2,
    white_rating_after = $3,
    black_rating_after = $4,
    finished_at = NOW()
WHERE id = $1
  AND result = 'pending'
RETURNING
    id,
    white_id,
    black_id,
    time_control,
    white_rating_before,
    black_rating_before,
    white_rating_after,
    black_rating_after,
    result,
    created_at,
    finished_at;
-- name: GetPlayerRecentMatches :many
SELECT
    m.id,
    m.white_id,
    white_user.username AS white_username,
    m.black_id,
    black_user.username AS black_username,
    m.time_control,
    m.white_rating_before,
    m.black_rating_before,
    m.white_rating_after,
    m.black_rating_after,
    m.result,
    m.created_at,
    m.finished_at
FROM matches AS m
INNER JOIN users AS white_user
    ON white_user.id = m.white_id
INNER JOIN users AS black_user
    ON black_user.id = m.black_id
WHERE
    (m.white_id = $1 OR m.black_id = $1)
    AND m.result <> 'pending'
ORDER BY m.finished_at DESC
LIMIT $2;

-- name: GetMatchState :one
SELECT
    m.id,
    m.white_id,
    m.black_id,
    m.time_control,
    m.result,
    m.created_at,
    m.finished_at,
    mm.move_number,
    mm.fen_after,
    mm.white_time_ms,
    mm.black_time_ms
FROM matches m
LEFT JOIN match_moves mm
    ON mm.match_id = m.id
   AND mm.move_number = (
       SELECT MAX(move_number)
       FROM match_moves
       WHERE match_id = m.id
   )
WHERE m.id = $1;

-- name: GetMatchForPlayer :one
SELECT
    id,
    white_id,
    black_id,
    time_control,
    white_rating_before,
    black_rating_before,
    white_rating_after,
    black_rating_after,
    result,
    created_at,
    finished_at
FROM matches
WHERE id = $1
  AND (
      white_id = $2
      OR black_id = $2
);

-- name: GetMatchDetailsForPlayer :one
SELECT
    m.id,

    m.white_id,
    white_user.username AS white_username,
    m.white_rating_before,

    m.black_id,
    black_user.username AS black_username,
    m.black_rating_before,

    m.time_control,
    m.result,

    m.created_at,
    m.finished_at
FROM matches AS m
INNER JOIN users AS white_user
    ON white_user.id = m.white_id
INNER JOIN users AS black_user
    ON black_user.id = m.black_id
WHERE m.id = $1
  AND (
      m.white_id = $2
      OR m.black_id = $2
);
