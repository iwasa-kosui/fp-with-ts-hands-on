ALTER TABLE `domain_events` RENAME TO `domain_events_legacy`;
--> statement-breakpoint
CREATE TABLE `domain_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`aggregate_id` text NOT NULL,
	`aggregate_name` text NOT NULL,
	`event_name` text NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`payload_sensitivity` text NOT NULL CHECK (`payload_sensitivity` IN ('Regular', 'Sensitive'))
);
--> statement-breakpoint
CREATE TABLE `domain_event_payloads` (
	`event_id` text PRIMARY KEY NOT NULL,
	`aggregate_state` text,
	`event_payload` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `domain_events`(`event_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `domain_event_sensitive_payloads` (
	`event_id` text PRIMARY KEY NOT NULL,
	`aggregate_state` text,
	`event_payload` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `domain_events`(`event_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `domain_events` (
	`event_id`, `aggregate_id`, `aggregate_name`, `event_name`, `occurred_at`,
	`actor_user_id`, `payload_sensitivity`
)
SELECT
	`event_id`, `aggregate_id`, `aggregate_name`, `event_name`, `occurred_at`,
	`actor_user_id`, 'Sensitive'
FROM `domain_events_legacy`;
--> statement-breakpoint
INSERT INTO `domain_event_sensitive_payloads` (
	`event_id`, `aggregate_state`, `event_payload`
)
SELECT `event_id`, `aggregate_state`, `event_payload`
FROM `domain_events_legacy`;
--> statement-breakpoint
DROP TABLE `domain_events_legacy`;
--> statement-breakpoint
CREATE TRIGGER `domain_event_payloads_classification`
BEFORE INSERT ON `domain_event_payloads`
BEGIN
	SELECT CASE
		WHEN EXISTS (
			SELECT 1 FROM `domain_event_sensitive_payloads`
			WHERE `event_id` = NEW.`event_id`
		) THEN RAISE(ABORT, 'event payload already stored')
		WHEN NOT EXISTS (
			SELECT 1 FROM `domain_events`
			WHERE `event_id` = NEW.`event_id`
				AND `payload_sensitivity` = 'Regular'
		) THEN RAISE(ABORT, 'event payload classification mismatch')
	END;
END;
--> statement-breakpoint
CREATE TRIGGER `domain_event_sensitive_payloads_classification`
BEFORE INSERT ON `domain_event_sensitive_payloads`
BEGIN
	SELECT CASE
		WHEN EXISTS (
			SELECT 1 FROM `domain_event_payloads`
			WHERE `event_id` = NEW.`event_id`
		) THEN RAISE(ABORT, 'event payload already stored')
		WHEN NOT EXISTS (
			SELECT 1 FROM `domain_events`
			WHERE `event_id` = NEW.`event_id`
				AND `payload_sensitivity` = 'Sensitive'
		) THEN RAISE(ABORT, 'event payload classification mismatch')
	END;
END;
--> statement-breakpoint
CREATE TRIGGER `domain_events_append_only_update`
BEFORE UPDATE ON `domain_events`
BEGIN
	SELECT RAISE(ABORT, 'domain_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `domain_events_append_only_delete`
BEFORE DELETE ON `domain_events`
BEGIN
	SELECT RAISE(ABORT, 'domain_events is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `domain_event_payloads_append_only_update`
BEFORE UPDATE ON `domain_event_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_payloads is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `domain_event_payloads_append_only_delete`
BEFORE DELETE ON `domain_event_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_payloads is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `domain_event_sensitive_payloads_append_only_update`
BEFORE UPDATE ON `domain_event_sensitive_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_sensitive_payloads is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `domain_event_sensitive_payloads_append_only_delete`
BEFORE DELETE ON `domain_event_sensitive_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_sensitive_payloads is append-only');
END;
