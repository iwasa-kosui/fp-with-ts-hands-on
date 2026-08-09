CREATE VIEW `_0007_appointment_states` AS
	SELECT 'Projection' AS `source_kind`, `appointment_id` AS `source_id`, `state`
	FROM `appointments`
	UNION ALL
	SELECT 'Regular', `domain_events`.`event_id`, `domain_event_payloads`.`aggregate_state`
	FROM `domain_events`
	INNER JOIN `domain_event_payloads`
		ON `domain_event_payloads`.`event_id` = `domain_events`.`event_id`
	WHERE `domain_events`.`aggregate_name` = 'Appointment'
		AND `domain_event_payloads`.`aggregate_state` IS NOT NULL
	UNION ALL
	SELECT 'Sensitive', `domain_events`.`event_id`, `domain_event_sensitive_payloads`.`aggregate_state`
	FROM `domain_events`
	INNER JOIN `domain_event_sensitive_payloads`
		ON `domain_event_sensitive_payloads`.`event_id` = `domain_events`.`event_id`
	WHERE `domain_events`.`aggregate_name` = 'Appointment'
		AND `domain_event_sensitive_payloads`.`aggregate_state` IS NOT NULL;
--> statement-breakpoint
CREATE VIEW `_0007_appointment_timestamps` AS
SELECT
	`_0007_appointment_states`.`source_id` AS `source_id`,
	`timestamp`.`key` AS `field_name`,
	`timestamp`.`type` AS `value_type`,
	`timestamp`.`value` AS `value`,
	CASE
		WHEN substr(`timestamp`.`value`, -1, 1) = 'Z'
			THEN `timestamp`.`value`
		WHEN substr(`timestamp`.`value`, -6, 1) IN ('+', '-')
			THEN `timestamp`.`value`
		WHEN substr(`timestamp`.`value`, -5, 1) IN ('+', '-')
			THEN substr(`timestamp`.`value`, 1, length(`timestamp`.`value`) - 2)
				|| ':' || substr(`timestamp`.`value`, -2, 2)
		ELSE NULL
	END AS `sqlite_value`,
	CASE
		WHEN substr(`timestamp`.`value`, -1, 1) = 'Z'
			THEN length(`timestamp`.`value`)
		WHEN substr(`timestamp`.`value`, -6, 1) IN ('+', '-')
			THEN length(`timestamp`.`value`) - 5
		WHEN substr(`timestamp`.`value`, -5, 1) IN ('+', '-')
			THEN length(`timestamp`.`value`) - 4
		ELSE NULL
	END AS `timezone_start`
FROM `_0007_appointment_states`
INNER JOIN json_tree(
	CASE
		WHEN json_valid(`_0007_appointment_states`.`state`)
			THEN `_0007_appointment_states`.`state`
		ELSE '{}'
	END
) AS `timestamp`
WHERE `timestamp`.`key` IN (
	'scheduledAt', 'checkedInAt', 'examinationStartedAt',
	'examinationCompletedAt', 'receivedAt', 'settledAt', 'refundedAt', 'canceledAt'
);
--> statement-breakpoint
CREATE TABLE `_0007_appointment_validation` (
	`is_valid` integer NOT NULL CHECK (`is_valid` = 1)
);
--> statement-breakpoint
INSERT INTO `_0007_appointment_validation` (`is_valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `appointments`
	WHERE json_valid(`state`) <> 1
		OR json_type(`state`) IS NOT 'object'
		OR json_type(`state`, '$.scheduledAt') IS NOT 'text'
		OR json_extract(`state`, '$.scheduledAt') IS NOT `scheduled_at`
		OR json_type(`state`, '$.serviceCode') IS NOT 'text'
		OR json_extract(`state`, '$.serviceCode') IS NOT `service_code`
		OR json_type(`state`, '$.settlement') IS NOT 'object'
		OR json_type(`state`, '$.settlement.kind') IS NOT 'text'
		OR json_extract(`state`, '$.settlement.kind') IS NOT `settlement_status`
		OR CASE json_extract(`state`, '$.settlement.kind')
			WHEN 'NoPayment' THEN `deposit_amount` IS NOT NULL
			WHEN 'DepositReceived' THEN
				json_extract(`state`, '$.settlement.depositAmount') IS NOT `deposit_amount`
			WHEN 'Settled' THEN
				json_extract(`state`, '$.settlement.depositAmount') IS NOT `deposit_amount`
			WHEN 'DepositRefunded' THEN
				json_extract(`state`, '$.settlement.depositAmount') IS NOT `deposit_amount`
			ELSE 1
		END
)
OR EXISTS (
	SELECT 1
	FROM `_0007_appointment_states`
	WHERE json_valid(`state`) <> 1
		OR json_type(`state`) IS NOT 'object'
		OR json_type(`state`, '$.serviceCode') IS NOT 'text'
		OR json_type(`state`, '$.settlement') IS NOT 'object'
		OR json_type(`state`, '$.settlement.kind') IS NOT 'text'
		OR json_extract(`state`, '$.settlement.kind') NOT IN (
			'NoPayment', 'DepositReceived', 'Settled', 'DepositRefunded'
		)
)
OR EXISTS (
	SELECT 1
	FROM `_0007_appointment_timestamps`
	WHERE `value_type` <> 'text'
		OR `sqlite_value` IS NULL
		OR julianday(`sqlite_value`) IS NULL
		OR julianday(`sqlite_value`) < julianday('0000-01-01T00:00:00.000Z')
		OR julianday(`sqlite_value`) > julianday('9999-12-31T23:59:59.999Z')
		OR date(substr(`value`, 1, 10)) IS NULL
		OR date(substr(`value`, 1, 10)) <> substr(`value`, 1, 10)
		OR substr(`value`, 1, 4) NOT GLOB '[0-9][0-9][0-9][0-9]'
		OR substr(`value`, 5, 1) <> '-'
		OR substr(`value`, 6, 2) NOT GLOB '[0-9][0-9]'
		OR substr(`value`, 8, 1) <> '-'
		OR substr(`value`, 9, 2) NOT GLOB '[0-9][0-9]'
		OR substr(`value`, 11, 1) <> 'T'
		OR substr(`value`, 12, 2) NOT GLOB '[0-9][0-9]'
		OR CAST(substr(`value`, 12, 2) AS integer) NOT BETWEEN 0 AND 23
		OR substr(`value`, 14, 1) <> ':'
		OR substr(`value`, 15, 2) NOT GLOB '[0-9][0-9]'
		OR CAST(substr(`value`, 15, 2) AS integer) NOT BETWEEN 0 AND 59
		OR NOT (
			`timezone_start` = 17
			OR (
				substr(`value`, 17, 1) = ':'
				AND substr(`value`, 18, 2) GLOB '[0-9][0-9]'
				AND CAST(substr(`value`, 18, 2) AS integer) BETWEEN 0 AND 59
				AND (
					`timezone_start` = 20
					OR (
						substr(`value`, 20, 1) = '.'
						AND `timezone_start` BETWEEN 22 AND 24
						AND substr(
							`value`, 21, `timezone_start` - 21
						) NOT GLOB '*[^0-9]*'
					)
				)
			)
		)
		OR NOT (
			substr(`value`, -1, 1) = 'Z'
			OR (
				substr(`value`, -6, 1) IN ('+', '-')
				AND substr(`value`, -5, 2) GLOB '[0-9][0-9]'
				AND substr(`value`, -3, 1) = ':'
				AND substr(`value`, -2, 2) GLOB '[0-9][0-9]'
				AND CAST(substr(`value`, -5, 2) AS integer) BETWEEN 0 AND 14
				AND CAST(substr(`value`, -2, 2) AS integer) BETWEEN 0 AND 59
				AND (
					CAST(substr(`value`, -5, 2) AS integer) < 14
					OR CAST(substr(`value`, -2, 2) AS integer) = 0
				)
			)
			OR (
				substr(`value`, -5, 1) IN ('+', '-')
				AND substr(`value`, -4, 4) GLOB '[0-9][0-9][0-9][0-9]'
				AND CAST(substr(`value`, -4, 2) AS integer) BETWEEN 0 AND 14
				AND CAST(substr(`value`, -2, 2) AS integer) BETWEEN 0 AND 59
				AND (
					CAST(substr(`value`, -4, 2) AS integer) < 14
					OR CAST(substr(`value`, -2, 2) AS integer) = 0
				)
			)
		)
) OR EXISTS (
	SELECT 1
	FROM `_0007_appointment_states`
	WHERE json_extract(`state`, '$.serviceCode') IS NOT 'Vaccination'
		AND (
			json_extract(`state`, '$.settlement.kind') IN (
				'DepositReceived', 'DepositRefunded'
			)
			OR (
				json_extract(`state`, '$.settlement.kind') = 'Settled'
				AND json_extract(`state`, '$.settlement.depositAmount') > 0
			)
		)
) OR EXISTS (
	SELECT 1
	FROM `_0007_appointment_states`
	WHERE json_extract(`state`, '$.settlement.kind') = 'DepositReceived'
		AND (
			json_type(`state`, '$.settlement.depositAmount') IS NOT 'integer'
			OR json_extract(`state`, '$.settlement.depositAmount') <= 0
			OR json_type(`state`, '$.settlement.receivedAt') IS NOT 'text'
		)
) OR EXISTS (
	SELECT 1
	FROM `_0007_appointment_states`
	WHERE json_extract(`state`, '$.settlement.kind') = 'DepositRefunded'
		AND (
			json_type(`state`, '$.settlement.depositAmount') IS NOT 'integer'
			OR json_extract(`state`, '$.settlement.depositAmount') <= 0
			OR json_type(`state`, '$.settlement.refundedAt') IS NOT 'text'
		)
) OR EXISTS (
	SELECT 1
	FROM `_0007_appointment_states`
	WHERE json_extract(`state`, '$.settlement.kind') = 'Settled'
		AND (
			json_type(`state`, '$.settlement.settledAt') IS NOT 'text'
			OR json_type(`state`, '$.settlement.finalAmount') IS NOT 'integer'
			OR json_type(`state`, '$.settlement.depositAmount') IS NOT 'integer'
			OR json_type(`state`, '$.settlement.additionalPaymentAmount') IS NOT 'integer'
			OR json_type(`state`, '$.settlement.refundAmount') IS NOT 'integer'
			OR json_extract(`state`, '$.settlement.finalAmount') <= 0
			OR json_extract(`state`, '$.settlement.depositAmount') < 0
			OR json_extract(`state`, '$.settlement.additionalPaymentAmount') < 0
			OR json_extract(`state`, '$.settlement.refundAmount') < 0
			OR json_extract(`state`, '$.settlement.additionalPaymentAmount') <>
				max(
					json_extract(`state`, '$.settlement.finalAmount') -
					json_extract(`state`, '$.settlement.depositAmount'),
					0
				)
			OR json_extract(`state`, '$.settlement.refundAmount') <>
				max(
					json_extract(`state`, '$.settlement.depositAmount') -
					json_extract(`state`, '$.settlement.finalAmount'),
					0
				)
		)
) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE `_0007_appointment_validation`;
--> statement-breakpoint
DROP VIEW `_0007_appointment_timestamps`;
--> statement-breakpoint
DROP VIEW `_0007_appointment_states`;
