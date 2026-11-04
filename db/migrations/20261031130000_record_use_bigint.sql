-- migrate:up

ALTER TABLE `tblRecords` MODIFY `ID` bigint NOT NULL AUTO_INCREMENT;

-- migrate:down

ALTER TABLE `tblRecords` MODIFY `ID` int NOT NULL AUTO_INCREMENT;
