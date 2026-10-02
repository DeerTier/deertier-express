-- migrate:up

-- Leaderboard extensions. Each extension is a separate set of categories, selected by the leftmost part of the host name (Name), e.g. "ext" in "ext.deertier.com".
-- Description is shown as the subtitle in the site header.
CREATE TABLE `tblExtensions` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Description` varchar(200) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `idx_tblExtensions_Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `tblExtensions` (`Id`, `Name`, `Description`) VALUES (1,'deertier','Hall of Fame');

-- Existing categories belong to the main leaderboard
ALTER TABLE `tblCategories`
  ADD COLUMN `ExtensionId` int NOT NULL DEFAULT 1 AFTER `SectionId`,
  ADD KEY `idx_tblCategories_ExtensionId` (`ExtensionId`);

-- migrate:down

ALTER TABLE `tblCategories`
  DROP KEY `idx_tblCategories_ExtensionId`,
  DROP COLUMN `ExtensionId`;

DROP TABLE `tblExtensions`;
