-- migrate:up

-- Every submitted record is kept. Status tracks moderation: new records are Pending until a moderator approves or
-- rejects them, and deleting a record only marks it Deleted. A player's best Approved record in a category is the one
-- shown on the leaderboard. StatusComment/StatusChangedByUserId/StatusChangedAt describe the latest status change,
-- the full history is in tblModerationLog.
ALTER TABLE `tblRecords`
  ADD COLUMN `Status` ENUM('Pending', 'Approved', 'Rejected', 'Deleted') NOT NULL DEFAULT 'Pending',
  ADD COLUMN `StatusComment` varchar(1000) DEFAULT NULL,
  ADD COLUMN `StatusChangedByUserId` int DEFAULT NULL,
  ADD COLUMN `StatusChangedAt` datetime(6) DEFAULT NULL,
  ADD KEY `idx_tblRecords_Status` (`Status`);

-- Records that existed before verification are already trusted
UPDATE `tblRecords` SET `Status` = 'Approved';

-- Move deleted records back into tblRecords as Deleted. They keep their ID, which tblModerationLog refers to, unless a
-- later record reused it (older MySQL versions reset auto-increment on restart). Those get an ID above all existing ones.
SET @idOffset = GREATEST(
  (SELECT COALESCE(MAX(`ID`), 0) FROM `tblRecords`),
  (SELECT COALESCE(MAX(`ID`), 0) FROM `tblRecordDeletionLog`));

CREATE TEMPORARY TABLE `tmpDeletedRecordIds` AS
SELECT d.`ID` AS `OldId`, IF(EXISTS (SELECT 1 FROM `tblRecords` r WHERE r.`ID` = d.`ID`), d.`ID` + @idOffset, d.`ID`) AS `NewId`
FROM `tblRecordDeletionLog` d;

-- Action 2 = DeleteRecord
UPDATE `tblModerationLog` m
JOIN `tmpDeletedRecordIds` t ON t.`OldId` = m.`RelatedId1` AND t.`NewId` <> t.`OldId`
SET m.`RelatedId1` = t.`NewId`
WHERE m.`Action` = 2;

-- Keep the moderator IP address of deletions that predate tblModerationLog
INSERT INTO `tblModerationLog` (`UserId`, `Action`, `Description`, `RelatedId1`, `Date`, `IPAddress`, `UserAgent`)
SELECT
  COALESCE((SELECT MIN(u.`ID`) FROM `tblUsers` u WHERE u.`Name` = d.`Moderator`), 0),
  2,
  CONCAT('Deleted record [', t.`NewId`, '] for user [', d.`Player`, '] in category [', d.`CategoryId`, ']'),
  t.`NewId`,
  COALESCE(d.`DeletionDate`, NOW(6)),
  d.`IPAddress`,
  ''
FROM `tblRecordDeletionLog` d
JOIN `tmpDeletedRecordIds` t ON t.`OldId` = d.`ID`
WHERE NOT EXISTS (SELECT 1 FROM `tblModerationLog` m WHERE m.`Action` = 2 AND m.`RelatedId1` = t.`NewId`);

INSERT INTO `tblRecords` (`ID`, `CategoryId`, `Player`, `RealTimeSeconds`, `RealTimeString`, `GameTimeSeconds`, `GameTimeString`,
  `Comment`, `VideoURL`, `CeresTime`, `DateSubmitted`, `SubmittedByUserId`, `Status`, `StatusChangedByUserId`, `StatusChangedAt`)
SELECT
  t.`NewId`,
  d.`CategoryId`, d.`Player`, d.`RealTimeSeconds`, d.`RealTimeString`, d.`GameTimeSeconds`, d.`GameTimeString`,
  d.`Comment`, d.`VideoURL`, d.`CeresTime`, d.`DateSubmitted`, d.`SubmittedByUserId`,
  'Deleted',
  (SELECT MIN(u.`ID`) FROM `tblUsers` u WHERE u.`Name` = d.`Moderator`),
  d.`DeletionDate`
FROM `tblRecordDeletionLog` d
JOIN `tmpDeletedRecordIds` t ON t.`OldId` = d.`ID`;

DROP TEMPORARY TABLE `tmpDeletedRecordIds`;

DROP TABLE `tblRecordDeletionLog`;

-- How new records in a category are verified.
-- All: every record waits in the moderation queue. Defaults to All, which is how every category worked so far.
-- None: records are approved when submitted.
-- More modes (e.g. only top X records, or records under a time) can be added to the ENUM later.
ALTER TABLE `tblCategories`
  ADD COLUMN `VerificationMode` ENUM('All', 'None') NOT NULL DEFAULT 'All' AFTER `AllowSubmission`;

-- The reason a moderator gave for an action (e.g. why a record was rejected). tblRecords.StatusComment only keeps the
-- reason of a record's latest status change, the log keeps all of them.
ALTER TABLE `tblModerationLog`
  ADD COLUMN `Reason` varchar(1000) DEFAULT NULL AFTER `Description`;

-- migrate:down

ALTER TABLE `tblModerationLog` DROP COLUMN `Reason`;

ALTER TABLE `tblCategories` DROP COLUMN `VerificationMode`;

CREATE TABLE `tblRecordDeletionLog` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `Moderator` varchar(100) NOT NULL,
  `DeletionDate` datetime(6) DEFAULT NULL,
  `CategoryId` int NOT NULL,
  `Player` varchar(100) NOT NULL,
  `RealTimeString` varchar(100) NOT NULL,
  `GameTimeString` varchar(100) DEFAULT NULL,
  `RealTimeSeconds` int NOT NULL,
  `GameTimeSeconds` int DEFAULT NULL,
  `Comment` varchar(100) DEFAULT NULL,
  `VideoURL` varchar(100) DEFAULT NULL,
  `CeresTime` decimal(4,2) DEFAULT NULL,
  `DateSubmitted` datetime(6) DEFAULT NULL,
  `SubmittedByUserId` int DEFAULT NULL,
  `IPAddress` varchar(100) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `tblRecordDeletionLog` (`ID`, `Moderator`, `DeletionDate`, `CategoryId`, `Player`, `RealTimeString`, `GameTimeString`,
  `RealTimeSeconds`, `GameTimeSeconds`, `Comment`, `VideoURL`, `CeresTime`, `DateSubmitted`, `SubmittedByUserId`, `IPAddress`)
SELECT
  r.`ID`, COALESCE(u.`Name`, ''), r.`StatusChangedAt`, r.`CategoryId`, r.`Player`, r.`RealTimeString`, r.`GameTimeString`,
  r.`RealTimeSeconds`, r.`GameTimeSeconds`, r.`Comment`, r.`VideoURL`, r.`CeresTime`, r.`DateSubmitted`, r.`SubmittedByUserId`,
  COALESCE((SELECT m.`IPAddress` FROM `tblModerationLog` m WHERE m.`Action` = 2 AND m.`RelatedId1` = r.`ID` ORDER BY m.`Id` DESC LIMIT 1), '')
FROM `tblRecords` r
LEFT JOIN `tblUsers` u ON u.`ID` = r.`StatusChangedByUserId`
WHERE r.`Status` = 'Deleted';

-- Before this migration there was one record per player and category, the newest submission
DELETE FROM `tblRecords` WHERE `Status` <> 'Approved';

DELETE r FROM `tblRecords` r
JOIN `tblRecords` newer ON newer.`CategoryId` = r.`CategoryId` AND newer.`Player` = r.`Player` AND newer.`ID` > r.`ID`;

ALTER TABLE `tblRecords`
  DROP KEY `idx_tblRecords_Status`,
  DROP COLUMN `Status`,
  DROP COLUMN `StatusComment`,
  DROP COLUMN `StatusChangedByUserId`,
  DROP COLUMN `StatusChangedAt`;
