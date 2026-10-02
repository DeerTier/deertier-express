-- migrate:up

-- Administrators manage the site (extensions, categories). Separate from IsModerator, which covers moderating submissions.
ALTER TABLE `tblUsers` ADD COLUMN `IsAdministrator` tinyint(1) NOT NULL DEFAULT 0 AFTER `IsModerator`;

-- migrate:down

ALTER TABLE `tblUsers` DROP COLUMN `IsAdministrator`;
