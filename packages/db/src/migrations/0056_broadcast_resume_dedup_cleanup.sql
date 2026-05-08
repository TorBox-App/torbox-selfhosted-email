-- Broadcast Resume: message_send dedup cleanup
--
-- Before the CONCURRENT unique-index script can run, any existing
-- duplicate (batch_send_id, contact_id) tuples on message_send must be
-- removed. Keeps the oldest row per (batch_send_id, contact_id) group.
--
-- Pre-flight guard: abort if the duplicate-candidate set is unexpectedly
-- large. If you hit this guard, run the DELETE manually with chunking
-- and then retry the migration.

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM message_send WHERE contact_id IS NOT NULL) > 5000000 THEN
    RAISE EXCEPTION 'Too many message_send rows (>5M); run dedup cleanup manually in chunks before re-running this migration';
  END IF;
END $$;
--> statement-breakpoint
DELETE FROM message_send
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY batch_send_id, contact_id
        ORDER BY created_at, id
      ) AS rn
    FROM message_send
    WHERE contact_id IS NOT NULL
  ) x
  WHERE rn > 1
);
