DELETE FROM `domain_events`
WHERE `event_name` = 'follow-up.requested'
  AND `rowid` NOT IN (
    SELECT MIN(`rowid`)
    FROM `domain_events`
    WHERE `event_name` = 'follow-up.requested'
    GROUP BY `aggregate_id`
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `follow_up_requested_appointment_unique`
ON `domain_events` (`aggregate_id`)
WHERE `event_name` = 'follow-up.requested';
