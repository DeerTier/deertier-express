-- migrate:up

UPDATE `refSections` SET `Name` = 'Escape IGT' WHERE `Id` = 3;
UPDATE `tblCategories` SET `Name` = 'Spore Spawn RTA', `ParentId` = 89, `SectionId` = NULL, `DisplayOrder` = 5 WHERE `Id` = 7;
UPDATE `tblCategories` SET `AllowSubmission` = 1, `Visible` = 1, `DisplayOrder` = 2, `Enabled` = 1 WHERE `Id` = 13;
UPDATE `tblCategories` SET `Name` = 'Crocomire RTA', `ParentId` = 89, `SectionId` = NULL WHERE `Id` = 14;
UPDATE `tblCategories` SET `DisplayOrder` = 4 WHERE `Id` = 92;

-- migrate:down

UPDATE `refSections` SET `Name` = 'Misc. Categories' WHERE `Id` = 3;
UPDATE `tblCategories` SET `Name` = 'Spore Spawn', `ParentId` = 0, `SectionId` = 3, `DisplayOrder` = 2 WHERE `Id` = 7;
UPDATE `tblCategories` SET `AllowSubmission` = 0, `Visible` = 0, `DisplayOrder` = 999, `Enabled` = 0 WHERE `Id` = 13;
UPDATE `tblCategories` SET `Name` = 'Crocomire', `ParentId` = 0, `SectionId` = 3 WHERE `Id` = 14;
UPDATE `tblCategories` SET `DisplayOrder` = 3 WHERE `Id` = 92;
