-- migrate:up

-- Optional note shown above a category's leaderboard. Rendered as raw HTML.
ALTER TABLE `tblCategories` ADD COLUMN `Note` varchar(1000) DEFAULT NULL AFTER `WikiUrl`;

-- migrate:down

ALTER TABLE `tblCategories` DROP COLUMN `Note`;
