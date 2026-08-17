local queue_key = KEYS[1]

local now = tonumber(ARGV[1])
local base_window = tonumber(ARGV[2])
local window_growth = tonumber(ARGV[3])
local max_window = tonumber(ARGV[4])
local limit = tonumber(ARGV[5])

local matches = {}
local removed = {}

local function is_removed(user_id)
    return removed[user_id] == true
end

local function mark_removed(user_id)
    removed[user_id] = true
end

-- iterate whole queue once
local players = redis.call("ZRANGE", queue_key, 0, -1, "WITHSCORES")

for i = 1, #players, 2 do
    if #matches >= limit then
        break
    end

    local p1_id = players[i]

    if not is_removed(p1_id) then
        local p1_rating = tonumber(players[i + 1])
        local p1_key = "matchmaking:user:" .. p1_id

        local joined_at =
            tonumber(redis.call("HGET", p1_key, "joined_at")) or now

        local wait_seconds = math.max(0, now - joined_at)

        local rating_window = math.min(
            max_window,
            base_window + math.floor(wait_seconds / 10) * window_growth
        )

        -- only fetch nearby rating candidates
        local candidates = redis.call(
            "ZRANGEBYSCORE",
            queue_key,
            p1_rating - rating_window,
            p1_rating + rating_window,
            "WITHSCORES"
        )

        local best_id = nil
        local best_rating = nil
        local best_diff = nil

        for j = 1, #candidates, 2 do
            local p2_id = candidates[j]

            if p2_id ~= p1_id and not is_removed(p2_id) then
                local p2_rating = tonumber(candidates[j + 1])
                local diff = math.abs(p1_rating - p2_rating)

                if best_diff == nil or diff < best_diff then
                    best_id = p2_id
                    best_rating = p2_rating
                    best_diff = diff
                end
            end
        end

        if best_id ~= nil then
            local p2_key = "matchmaking:user:" .. best_id

            -- only fetch usernames after match found
            local p1_username = redis.call("HGET", p1_key, "username")
            local p2_username = redis.call("HGET", p2_key, "username")

            -- remove from queue in one command
            redis.call("ZREM", queue_key, p1_id, best_id)

            -- delete metadata in one command
            redis.call("DEL", p1_key, p2_key)

            mark_removed(p1_id)
            mark_removed(best_id)

            table.insert(matches, {
                p1_id .. ":" .. best_id .. ":" .. tostring(now),
                p1_id,
                best_id,
                p1_rating,
                best_rating,
                p1_username,
                p2_username
            })
        end
    end
end

return matches
