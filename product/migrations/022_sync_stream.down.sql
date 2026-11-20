DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM sync_page_commit) OR EXISTS(SELECT 1 FROM sync_stream) THEN
  RAISE EXCEPTION 'sync downgrade requires empty history; preserve checkpoints and restore instead';
 END IF;
END $$;
DROP TABLE sync_page_commit;
DROP TABLE sync_stream;
