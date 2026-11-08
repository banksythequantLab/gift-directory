-- What a registry's group gifts add on top of the item's price for shipping and sales tax (an estimate,
-- charged at the store's checkout, not by us). Percent, 0-50; 10 by default.
ALTER TABLE registries ADD COLUMN ship_pct INTEGER NOT NULL DEFAULT 10;
