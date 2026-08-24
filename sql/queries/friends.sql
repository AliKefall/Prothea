-- name: CreateFriendRequest :execrows
INSERT INTO friend_requests (
    requester_id,
    target_id,
    created_at
)
VALUES (
    $1,
    $2,
    $3
)
ON CONFLICT DO NOTHING;

-- name: DeleteFriendRequest :exec
DELETE FROM friend_requests
WHERE
(requester_id = $1 AND target_id = $2)
OR
(requester_id = $2 AND target_id = $1);

-- name: FriendRequestExists :one
SELECT EXISTS (
    SELECT 1
    FROM friend_requests
    WHERE
        (requester_id = $1 AND target_id = $2)
        OR
        (requester_id = $2 AND target_id = $1)
);

-- name: ListIncomingFriendRequestsByUserID :many
SELECT
    u.id,
    u.username,
    u.created_at
FROM friend_requests fr
JOIN users u
ON u.id = fr.requester_id
WHERE fr.target_id = $1
ORDER BY fr.created_at DESC;

-- name: ListOutgoingFriendRequestsByUserID :many
SELECT
    u.id,
    u.username,
    u.created_at
FROM friend_requests fr
JOIN users u
    ON u.id = fr.target_id
WHERE fr.requester_id = $1
ORDER BY fr.created_at DESC;
-------

-- name: CreateFriendship :execrows
INSERT INTO friendships(
    user_id,
    friend_id,
    created_at
)
VALUES(
    $1,
    $2,
    $3
)
ON CONFLICT DO NOTHING;

-- name: DeleteFriendship :exec
DELETE FROM friendships
WHERE user_id = $1
    AND friend_id = $2;

-- name: FriendshipExists :one
SELECT EXISTS (
    SELECT 1
    FROM friendships
    WHERE user_id = $1
        AND friend_id = $2
);

-- name: ListFriendsByUserID :many
SELECT
    u.id,
    u.username,
    u.created_at
FROM friendships f
JOIN users u
    ON u.id = CASE
        WHEN f.user_id = $1 THEN f.friend_id
        ELSE f.user_id
    END
WHERE f.user_id = $1
   OR f.friend_id = $1
ORDER BY u.username;

