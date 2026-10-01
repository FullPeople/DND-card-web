CREATE INDEX receipts_cleanup ON operation_receipts(character_id, julianday(created_at), operation_id);
