-- Which PayPal side a store's subscription lives on ("sandbox" for stores bought with a sandbox test account),
-- and which side a login was started on. Everything before this migration was sandbox.
ALTER TABLE stores ADD COLUMN paypal_mode TEXT;
UPDATE stores SET paypal_mode='sandbox' WHERE paypal_subscription_id IS NOT NULL;
ALTER TABLE oauth_states ADD COLUMN mode TEXT;
