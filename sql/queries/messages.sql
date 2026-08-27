-- name: CreateConversation :one
INSERT INTO conversations(
    id,
    type
)
VALUES(
    $1,
    $2
)
RETURNING *;

-- name: GetConversation :one
SELECT *
FROM conversations
WHERE id = $1;

-- name: DeleteConversation :exec
DELETE
FROM conversations
WHERE id = $1;

-- name: AddConversationMember :one
INSERT INTO conversation_members(
    conversation_id,
    user_id
)
VALUES(
    $1,
    $2
)
RETURNING *;

-- name: RemoveConversationMember :exec
DELETE
FROM conversation_members
WHERE conversation_id = $1
AND user_id = $2;

-- name: ListConversationMember :many
SELECT
    users.*
FROM conversation_members
JOIN users
ON users.id = conversation_members.user_id
WHERE conversation_members.conversation_id = $1;


-- name: FindDirectConversation :one
SELECT c.*
FROM conversations AS c
WHERE c.type = 'direct'
AND EXISTS (
    SELECT 1
    FROM conversation_members AS cm1
    WHERE cm1.conversation_id = c.id
      AND cm1.user_id = $1
)
AND EXISTS (
    SELECT 1
    FROM conversation_members AS cm2
    WHERE cm2.conversation_id = c.id
      AND cm2.user_id = $2
)
AND (
    SELECT COUNT(*)
    FROM conversation_members AS cm3
    WHERE cm3.conversation_id = c.id
) = 2;

-- name: GetMessage :one
SELECT *
FROM messages
WHERE id = $1;

-- name: ListMessages :many
SELECT *
FROM messages
WHERE conversation_id = $1
AND deleted_at IS NULL
ORDER BY created_at ASC
LIMIT $2
OFFSET $3;

-- name: GetLastMessage :one
SELECT *
FROM messages
WHERE conversation_id = $1
AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1;

-- name: EditMessage :one
UPDATE messages
SET
    content = $2,
    edited_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteMessage :exec
UPDATE messages
SET deleted_at = NOW()
WHERE id = $1;

-- name: CreateMessage :one
INSERT INTO messages(
    id,
    conversation_id,
    sender_id,
    content
)
VALUES(
    $1,
    $2,
    $3,
    $4
)
RETURNING *;

-- name: GetConversationMembers :many
SELECT users.*
FROM conversation_members
JOIN users
ON users.id = conversation_members.user_id
WHERE conversation_members.conversation_id = $1;

-- name: IsConversationMember :one
SELECT EXISTS(
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = $1
    AND user_id = $2
);

-- name: ListConversations :many
SELECT c.*
FROM conversations c
JOIN conversation_members cm
ON cm.conversation_id = c.id
WHERE cm.user_id = $1
ORDER BY c.created_at DESC;
