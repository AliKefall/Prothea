local queue_key = KEYS[1]
local user_key = KEYS[2]

local user_id = ARGV[1]
local username = ARGV[2]
local rating = tonumber(ARGV[3])
local joined_at = tonumber(ARGV[4])
local time_control = ARGV[5]
local ttl = tonumber(ARGV[6])

if redis.call("EXISTS", user_key) == 1 then
    return redis.error_reply("already queued")
end

redis.call("ZADD", queue_key, rating, user_id)

redis.call("HSET", user_key,
    "user_id", user_id,
    "username", username,
    "rating", rating,
    "joined_at", joined_at,
    "time_control", time_control
)

redis.call("EXPIRE", user_key, ttl)

return "ok"
