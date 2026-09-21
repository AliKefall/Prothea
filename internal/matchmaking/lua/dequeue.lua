local queue_key = KEYS[1]
local queue_key = KEYS[1]
local user_key = KEYS[2]

local user_id = ARGV[1]

if redis.call("ZSCORE", queue_key, user_id) == false then
    return 0
end

redis.call("ZREM", queue_key, user_id)
redis.call("DEL", user_key)

return 1
