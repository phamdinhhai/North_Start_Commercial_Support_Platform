DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM source_episode_link) THEN RAISE EXCEPTION 'source episode link rollback requires empty history'; END IF;
END $$;
DROP TABLE source_episode_link;
