/*M!999999\- enable the sandbox mode */
-- MariaDB dump 10.19-11.8.8-MariaDB, for Linux (x86_64)
--
-- Host: db    Database: deertier
-- ------------------------------------------------------
-- Server version	8.4.11

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `refSections`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `refSections` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(200) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schema_migrations`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `version` varchar(128) NOT NULL,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tblCategories`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblCategories` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(200) NOT NULL,
  `UrlName` varchar(200) DEFAULT NULL,
  `ParentId` int DEFAULT NULL,
  `SectionId` int DEFAULT NULL,
  `ExtensionId` int NOT NULL DEFAULT '1',
  `AllowSubmission` tinyint(1) NOT NULL,
  `VerificationMode` enum('All','None') NOT NULL DEFAULT 'All',
  `Visible` tinyint(1) NOT NULL,
  `DisplayOrder` int NOT NULL,
  `GameTime` tinyint(1) NOT NULL,
  `EscapeGameTime` tinyint(1) NOT NULL,
  `RealTime` tinyint(1) NOT NULL,
  `ShortName` varchar(200) DEFAULT NULL,
  `Enabled` tinyint(1) NOT NULL,
  `WikiUrl` varchar(200) DEFAULT NULL,
  `Note` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `idx_tblCategories_ExtensionId` (`ExtensionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tblExtensions`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblExtensions` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Description` varchar(200) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `idx_tblExtensions_Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tblModerationLog`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblModerationLog` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `UserId` int NOT NULL,
  `Action` tinyint unsigned NOT NULL,
  `Description` varchar(1000) DEFAULT NULL,
  `Reason` varchar(1000) DEFAULT NULL,
  `RelatedId1` int DEFAULT NULL,
  `RelatedId2` int DEFAULT NULL,
  `RelatedId3` int DEFAULT NULL,
  `Date` datetime(6) NOT NULL,
  `IPAddress` varchar(100) NOT NULL,
  `UserAgent` varchar(1000) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tblRecords`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
  `Status` enum('Pending','Approved','Rejected','Deleted') NOT NULL DEFAULT 'Pending',
  `StatusComment` varchar(1000) DEFAULT NULL,
  `StatusChangedByUserId` int DEFAULT NULL,
  `StatusChangedAt` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `idx_tblRecords_CategoryId` (`CategoryId`),
  KEY `idx_tblRecords_Status` (`Status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tblUsers`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tblUsers` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(100) NOT NULL,
  `Password` varchar(100) NOT NULL,
  `PasswordType` tinyint unsigned NOT NULL,
  `IsModerator` tinyint unsigned NOT NULL,
  `IsAdministrator` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  KEY `idx_tblUsers_IsModerator` (`IsModerator`),
  KEY `idx_tblUsers_Name` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'deertier'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed

--
-- Dbmate schema migrations
--

LOCK TABLES `schema_migrations` WRITE;
INSERT INTO `schema_migrations` (version) VALUES
  ('20261002190152'),
  ('20261002190354'),
  ('20261002201055'),
  ('20261003120000'),
  ('20261003130000'),
  ('20261003140000'),
  ('20261003150000');
UNLOCK TABLES;
