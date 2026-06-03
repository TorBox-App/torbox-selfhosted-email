CREATE INDEX IF NOT EXISTS "message_send_org_channel_sent_at_idx" ON "message_send" ("organization_id","channel","sent_at");
