-- migrate:up

-- refSections is the table for top level sections (i.e. NMG, MG, Misc)
CREATE TABLE `refSections` (
  `Id` int NOT NULL,
  `Name` varchar(200) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- tblCategories is the categories table
CREATE TABLE `tblCategories` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(200) NOT NULL,
  `UrlName` varchar(200) DEFAULT NULL,
  `ParentId` int DEFAULT NULL,
  `SectionId` int DEFAULT NULL,
  `AllowSubmission` tinyint(1) NOT NULL,
  `Visible` tinyint(1) NOT NULL,
  `DisplayOrder` int NOT NULL,
  `GameTime` tinyint(1) NOT NULL,
  `EscapeGameTime` tinyint(1) NOT NULL,
  `RealTime` tinyint(1) NOT NULL,
  `ShortName` varchar(200) DEFAULT NULL,
  `Enabled` tinyint(1) NOT NULL,
  `WikiUrl` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- tblModerationLog is a log of moderator actions (e.g. deleting or creating records)
CREATE TABLE `tblModerationLog` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `UserId` int NOT NULL,
  `Action` tinyint unsigned NOT NULL,
  `Description` varchar(1000) DEFAULT NULL,
  `RelatedId1` int DEFAULT NULL,
  `RelatedId2` int DEFAULT NULL,
  `RelatedId3` int DEFAULT NULL,
  `Date` datetime(6) NOT NULL,
  `IPAddress` varchar(100) NOT NULL,
  `UserAgent` varchar(1000) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- tblRecordDeletionLog keeps a copy of every record that is deleted from tblRecords
-- TODO:
-- - consider leaving deleted records in tblRecords with an IsDeleted flag instead of copying them here
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

-- tblRecords is the table that holds records (i.e. times/runs) for all categories
-- TODO:
-- - replace the Player column with UserId
-- - remove RealTimeString and GameTimeString columns
-- - normalize how times are stored in general
CREATE TABLE `tblRecords` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `CategoryId` int NOT NULL,
  `Player` varchar(100) NOT NULL,
  `RealTimeSeconds` int NOT NULL,
  `RealTimeString` varchar(100) NOT NULL,
  `GameTimeSeconds` int DEFAULT NULL,
  `GameTimeString` varchar(100) DEFAULT NULL,
  `Comment` varchar(100) DEFAULT NULL,
  `VideoURL` varchar(100) DEFAULT NULL,
  `CeresTime` decimal(4,2) DEFAULT NULL,
  `DateSubmitted` datetime(6) DEFAULT NULL,
  `SubmittedByUserId` int DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `idx_tblRecords_CategoryId` (`CategoryId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- tblUsers is the users table. Passwords are hashed.
CREATE TABLE `tblUsers` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Password` varchar(100) NOT NULL,
  `PasswordType` tinyint unsigned NOT NULL,
  `IsModerator` tinyint unsigned NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `idx_tblUsers_IsModerator` (`IsModerator`),
  KEY `idx_tblUsers_Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- migrate:down

DROP TABLE `tblUsers`;
DROP TABLE `tblRecords`;
DROP TABLE `tblRecordDeletionLog`;
DROP TABLE `tblModerationLog`;
DROP TABLE `tblCategories`;
DROP TABLE `refSections`;
