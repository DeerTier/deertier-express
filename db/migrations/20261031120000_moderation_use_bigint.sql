-- migrate:up

ALTER TABLE `tblModerationLog` MODIFY `Id` bigint NOT NULL AUTO_INCREMENT;

-- migrate:down

ALTER TABLE `tblModerationLog` MODIFY `Id` int NOT NULL AUTO_INCREMENT;
