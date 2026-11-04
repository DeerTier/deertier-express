-- migrate:up

ALTER TABLE `tblRecords` ADD COLUMN `UserId` int NULL;

UPDATE `tblRecords` r
JOIN `tblUsers` u ON r.`Player` = u.`Name`
SET r.`UserId` = u.`ID`;

INSERT INTO `tblModerationLog` (`UserId`, `Action`, `Description`, `Date`, `IPAddress`, `UserAgent`)
SELECT
  0,
  2,
  CONCAT('Deleted record [', r.`ID`, '] for player without user id [', r.`Player`, '] in category [', r.`CategoryId`, '] with real time [', r.`RealTimeString`, ']'),
  NOW(6),
  '0.0.0.0',
  'Database Migration'
FROM `tblRecords` r WHERE `UserId` IS NULL;

DELETE FROM `tblRecords` WHERE `UserId` IS NULL;

ALTER TABLE `tblRecords` MODIFY COLUMN `UserId` int NOT NULL;

ALTER TABLE `tblRecords` DROP COLUMN `Player`;

-- migrate:down

ALTER TABLE `tblRecords` ADD COLUMN `Player` varchar(100) DEFAULT NULL;

UPDATE `tblRecords` r
JOIN `tblUsers` u ON r.`ID` = u.`UserId`
SET r.`Player` = u.`Name`;

INSERT INTO `tblModerationLog` (`UserId`, `Action`, `Description`, `Date`, `IPAddress`, `UserAgent`)
SELECT
  0,
  2,
  CONCAT('Deleted record [', r.`ID`, '] for user id without name [', r.`UserId`, '] in category [', r.`CategoryId`, '] with real time [', r.`RealTimeString`, ']'),
  NOW(6),
  '0.0.0.0',
  'Database Migration'
FROM `tblRecords` r WHERE `Player` IS NULL;

DELETE FROM `tblRecords` WHERE `Player` IS NULL;

ALTER TABLE `tblRecords` MODIFY COLUMN `Player` int NOT NULL;

ALTER TABLE `tblRecords` DROP COLUMN `UserId`;

