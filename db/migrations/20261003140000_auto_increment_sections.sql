-- migrate:up

-- Sections can be added from the admin pages, so let the database assign their ids like the other tables
ALTER TABLE `refSections` MODIFY `Id` int NOT NULL AUTO_INCREMENT;

-- migrate:down

ALTER TABLE `refSections` MODIFY `Id` int NOT NULL;
