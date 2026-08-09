CREATE TABLE IF NOT EXISTS `follow_up_request_claims` (
	`appointment_id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
INSERT INTO `follow_up_request_claims` (`appointment_id`)
SELECT DISTINCT `aggregate_id`
FROM `domain_events`
WHERE `event_name` = 'follow-up.requested'
ON CONFLICT (`appointment_id`) DO NOTHING;
