DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM fabricated_delivery) OR EXISTS(SELECT 1 FROM fabricated_delivery_attempt) THEN
  RAISE EXCEPTION 'fabricated delivery downgrade requires empty history';
 END IF;
END $$;
DROP TABLE fabricated_delivery_attempt;
DROP TABLE fabricated_delivery;
