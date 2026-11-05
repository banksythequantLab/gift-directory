-- Lawyer Gifts: store #1, the house store. No subscription (it's ours); the lawyer-tuned finder prompt
-- (config.house) and the court-gift check it was built with.
INSERT OR IGNORE INTO stores (id,slug,name,tagline,niche,config_json,owner_email,manage_hash,status,custom_host,created_at,updated_at)
VALUES ('store-lawyers','lawyers','Lawyer Gifts',
  'Real gifts for lawyers and the people who thank them, picked by AI and in stock now.',
  'lawyers, law firms and the clients who thank them',
  '{"house":true,"accent":"#1f3a5f","occasions":["Won my case","Passed the bar","Sworn in","Made partner","New firm","Retirement","Holiday — clients","Holiday — staff","Wedding","Birthday","For a judge or clerk"],"recipient_examples":["My divorce lawyer","A new associate","The whole litigation team"]}',
  'owner@example.com', 'house-store-no-manage-token', 'active', 'gifts.nota.lawyer',
  '2026-11-05T00:00:00Z', '2026-11-05T00:00:00Z');
UPDATE pools SET store_id='store-lawyers' WHERE store_id IS NULL;
UPDATE searches SET store_id='store-lawyers' WHERE store_id IS NULL;
