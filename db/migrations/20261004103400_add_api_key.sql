-- migrate:up

ALTER TABLE `tblUsers`
  ADD COLUMN `ApiKeyHash` char(64) DEFAULT NULL,
  ADD UNIQUE KEY `idx_tblUsers_ApiKeyHash` (`ApiKeyHash`);

-- migrate:down

ALTER TABLE `tblUsers`
  DROP KEY `idx_tblUsers_ApiKeyHash`,
  DROP COLUMN `ApiKeyHash`;
