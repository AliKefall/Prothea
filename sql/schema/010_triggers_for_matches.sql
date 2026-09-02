CREATE OR REPLACE FUNCTION validate_match_move_player()
RETURNS TRIGGER AS $$
DECLARE
    match_white UUID;
    match_black UUID;
BEGIN
    SELECT white_id, black_id
    INTO match_white, match_black
    FROM matches
    WHERE id = NEW.match_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'match does not exist';
    END IF;

    IF NEW.player_id <> match_white
       AND NEW.player_id <> match_black THEN
        RAISE EXCEPTION 'player is not part of the match';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_match_move_player
BEFORE INSERT ON match_moves
FOR EACH ROW
EXECUTE FUNCTION validate_match_move_player();
