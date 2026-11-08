-- Registry reminders: a guest asks for one email a week before the event. The row (and the email address)
-- is deleted once the reminder is sent or the guest unsubscribes.
CREATE TABLE IF NOT EXISTS registry_reminders (
  token TEXT PRIMARY KEY,             -- the unsubscribe link's secret
  registry_id TEXT NOT NULL,
  email TEXT NOT NULL,
  send_on TEXT NOT NULL,              -- YYYY-MM-DD (UTC): 7 days before the event, or the next run if that's passed
  ip_hash TEXT,                       -- sign-up rate limit only
  created_at TEXT NOT NULL,
  UNIQUE (registry_id, email)
);
CREATE INDEX IF NOT EXISTS registry_reminders_due ON registry_reminders(send_on);
CREATE INDEX IF NOT EXISTS registry_reminders_ip ON registry_reminders(ip_hash, created_at);
