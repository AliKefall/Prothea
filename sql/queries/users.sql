-- name: CreateUser :one
INSERT INTO users(
    id,
    email,
    username,
    password,
    created_at,
    updated_at
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUserByID :one
SELECT *
FROM users
WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;


-- name: GetUserByEmail :one
SELECT *
FROM users
WHERE email = $1;

-- name: GetUserByUsername :one
SELECT *
FROM users
WHERE username = $1;
