local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "last_refill_ms")
local tokens = tonumber(data[1])
local last_refill_ms = tonumber(data[2])

if tokens == nil or last_refill_ms == nil then
    tokens = capacity
    last_refill_ms = now_ms
end

local delta_seconds = math.max(0, now_ms - last_refill_ms) / 1000
tokens = math.min(capacity, tokens + delta_seconds * refill_rate)

local allowed = tokens >= 1
if allowed then
    tokens = tokens - 1
end

redis.call("HSET", key, "tokens", tokens, "last_refill_ms", now_ms)
redis.call("EXPIRE", key, ttl)

if allowed then
    return 1
else
    return 0
end
