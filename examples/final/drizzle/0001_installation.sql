CREATE TABLE IF NOT EXISTS `installation` (
	`installation_key` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
INSERT INTO `installation` (`installation_key`)
SELECT 'clinic'
WHERE EXISTS (SELECT 1 FROM `users`)
ON CONFLICT (`installation_key`) DO NOTHING;
