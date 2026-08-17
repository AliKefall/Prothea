-- name: CreateSession :one
INSERT INTO sessions (
    id,
    user_id,
    refresh_token_hash,
    user_agent,
    ip_address,
    created_at,
    expires_at,
    max_expires_at,
    last_used_at
)
VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
)
RETURNING *;


-- name: GetSessionByID :one
SELECT *
FROM sessions
WHERE id = $1;


-- name: GetSessionByTokenHash :one
SELECT *
FROM sessions
WHERE refresh_token_hash = $1
LIMIT 1;


-- name: GetValidSessionByTokenHash :one
SELECT *
FROM sessions
WHERE refresh_token_hash = $1
AND revoked_at IS NULL
AND expires_at > $2
LIMIT 1;


-- name: GetSessionForUpdateByTokenHash :one
SELECT *
FROM sessions
WHERE refresh_token_hash = $1
FOR UPDATE;


-- name: UpdateSessionToken :exec
UPDATE sessions
SET
    refresh_token_hash = $2,
    expires_at = $3,
    last_used_at = $4
WHERE id = $1;


-- name: RevokeSession :exec
UPDATE sessions
SET revoked_at = $2
WHERE id = $1;


-- name: RevokeSessionByTokenHash :exec
UPDATE sessions
SET revoked_at = $2
WHERE refresh_token_hash = $1;


-- name: DeleteSessionsByUserID :exec
DELETE FROM sessions
WHERE user_id = $1;


-- name: DeleteExpiredSessions :exec
DELETE FROM sessions
WHERE expires_at <= $1
OR revoked_at IS NOT NULL;


-- name: UpdateSessionLastUsed :exec
UPDATE sessions
SET last_used_at = $2
WHERE id = $1;
