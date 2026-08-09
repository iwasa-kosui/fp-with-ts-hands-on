CREATE VIEW `_0006_legacy_appointment_states` AS
SELECT
	'projection' AS `source`,
	`appointment_id` AS `expected_appointment_id`,
	`status` AS `expected_status`,
	`owner_id` AS `expected_owner_id`,
	`pet_id` AS `expected_pet_id`,
	COALESCE(json_valid(`state`), 0) AS `state_is_valid`,
	CASE WHEN json_valid(`state`) THEN `state` ELSE '{}' END AS `state`
FROM `appointments`
UNION ALL
SELECT
	'regular_audit',
	`domain_events`.`aggregate_id`,
	NULL,
	NULL,
	NULL,
	COALESCE(json_valid(`domain_event_payloads`.`aggregate_state`), 0),
	CASE
		WHEN json_valid(`domain_event_payloads`.`aggregate_state`)
			THEN `domain_event_payloads`.`aggregate_state`
		ELSE '{}'
	END
FROM `domain_event_payloads`
INNER JOIN `domain_events`
	ON `domain_events`.`event_id` = `domain_event_payloads`.`event_id`
WHERE `domain_events`.`aggregate_name` = 'Appointment'
UNION ALL
SELECT
	'sensitive_audit',
	`domain_events`.`aggregate_id`,
	NULL,
	NULL,
	NULL,
	COALESCE(json_valid(`domain_event_sensitive_payloads`.`aggregate_state`), 0),
	CASE
		WHEN json_valid(`domain_event_sensitive_payloads`.`aggregate_state`)
			THEN `domain_event_sensitive_payloads`.`aggregate_state`
		ELSE '{}'
	END
FROM `domain_event_sensitive_payloads`
INNER JOIN `domain_events`
	ON `domain_events`.`event_id` = `domain_event_sensitive_payloads`.`event_id`
WHERE `domain_events`.`aggregate_name` = 'Appointment';
--> statement-breakpoint
CREATE TABLE `_0006_legacy_appointment_validation` (
	`is_valid` integer NOT NULL CHECK (`is_valid` = 1)
);
--> statement-breakpoint
INSERT INTO `_0006_legacy_appointment_validation` (`is_valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `_0006_legacy_appointment_states`
	WHERE COALESCE((
		`state_is_valid` = 1
		AND json_type(`state`) = 'object'
		AND json_type(`state`, '$.kind') = 'text'
		AND json_extract(`state`, '$.kind') IN (
			'Scheduled', 'CheckedIn', 'InExamination',
			'AwaitingPayment', 'Paid', 'Canceled'
		)
		AND json_type(`state`, '$.appointmentId') = 'text'
		AND length(json_extract(`state`, '$.appointmentId')) = 36
		AND substr(json_extract(`state`, '$.appointmentId'), 9, 1) = '-'
		AND substr(json_extract(`state`, '$.appointmentId'), 14, 1) = '-'
		AND substr(json_extract(`state`, '$.appointmentId'), 19, 1) = '-'
		AND substr(json_extract(`state`, '$.appointmentId'), 24, 1) = '-'
		AND length(replace(json_extract(`state`, '$.appointmentId'), '-', '')) = 32
		AND lower(replace(json_extract(`state`, '$.appointmentId'), '-', ''))
			NOT GLOB '*[^0-9a-f]*'
		AND json_extract(`state`, '$.appointmentId') = `expected_appointment_id`
		AND json_type(`state`, '$.ownerId') = 'text'
		AND length(json_extract(`state`, '$.ownerId')) = 36
		AND substr(json_extract(`state`, '$.ownerId'), 9, 1) = '-'
		AND substr(json_extract(`state`, '$.ownerId'), 14, 1) = '-'
		AND substr(json_extract(`state`, '$.ownerId'), 19, 1) = '-'
		AND substr(json_extract(`state`, '$.ownerId'), 24, 1) = '-'
		AND length(replace(json_extract(`state`, '$.ownerId'), '-', '')) = 32
		AND lower(replace(json_extract(`state`, '$.ownerId'), '-', ''))
			NOT GLOB '*[^0-9a-f]*'
		AND json_type(`state`, '$.petId') = 'text'
		AND length(json_extract(`state`, '$.petId')) = 36
		AND substr(json_extract(`state`, '$.petId'), 9, 1) = '-'
		AND substr(json_extract(`state`, '$.petId'), 14, 1) = '-'
		AND substr(json_extract(`state`, '$.petId'), 19, 1) = '-'
		AND substr(json_extract(`state`, '$.petId'), 24, 1) = '-'
		AND length(replace(json_extract(`state`, '$.petId'), '-', '')) = 32
		AND lower(replace(json_extract(`state`, '$.petId'), '-', ''))
			NOT GLOB '*[^0-9a-f]*'
		AND (
			`source` <> 'projection'
			OR (
				json_extract(`state`, '$.kind') = `expected_status`
				AND json_extract(`state`, '$.ownerId') = `expected_owner_id`
				AND json_extract(`state`, '$.petId') = `expected_pet_id`
			)
		)
		AND json_type(`state`, '$.scheduledAt') = 'text'
		AND NOT EXISTS (
			SELECT 1
			FROM json_each(CASE json_extract(`state`, '$.kind')
				WHEN 'Scheduled' THEN json_array(
					json_extract(`state`, '$.scheduledAt')
				)
				WHEN 'CheckedIn' THEN json_array(
					json_extract(`state`, '$.scheduledAt'),
					json_extract(`state`, '$.checkedInAt')
				)
				WHEN 'InExamination' THEN json_array(
					json_extract(`state`, '$.scheduledAt'),
					json_extract(`state`, '$.checkedInAt'),
					json_extract(`state`, '$.examinationStartedAt')
				)
				WHEN 'AwaitingPayment' THEN json_array(
					json_extract(`state`, '$.scheduledAt'),
					json_extract(`state`, '$.checkedInAt'),
					json_extract(`state`, '$.examinationStartedAt'),
					json_extract(`state`, '$.examinationCompletedAt')
				)
				WHEN 'Paid' THEN json_array(
					json_extract(`state`, '$.scheduledAt'),
					json_extract(`state`, '$.checkedInAt'),
					json_extract(`state`, '$.examinationStartedAt'),
					json_extract(`state`, '$.examinationCompletedAt'),
					json_extract(`state`, '$.paidAt')
				)
				WHEN 'Canceled' THEN json_array(
					json_extract(`state`, '$.scheduledAt'),
					json_extract(`state`, '$.canceledAt')
				)
				ELSE json_array(NULL)
			END) AS `required_timestamp`
			WHERE `required_timestamp`.`type` <> 'text'
				OR length(`required_timestamp`.`value`) < 17
				OR substr(`required_timestamp`.`value`, 1, 4)
					NOT GLOB '[0-9][0-9][0-9][0-9]'
				OR substr(`required_timestamp`.`value`, 5, 1) <> '-'
				OR substr(`required_timestamp`.`value`, 6, 2)
					NOT GLOB '[0-9][0-9]'
				OR substr(`required_timestamp`.`value`, 8, 1) <> '-'
				OR substr(`required_timestamp`.`value`, 9, 2)
					NOT GLOB '[0-9][0-9]'
				OR substr(`required_timestamp`.`value`, 11, 1) <> 'T'
				OR date(substr(`required_timestamp`.`value`, 1, 10)) IS NULL
				OR date(substr(`required_timestamp`.`value`, 1, 10))
					<> substr(`required_timestamp`.`value`, 1, 10)
				OR substr(`required_timestamp`.`value`, 12, 2)
					NOT GLOB '[0-9][0-9]'
				OR CAST(substr(`required_timestamp`.`value`, 12, 2) AS integer)
					NOT BETWEEN 0 AND 23
				OR substr(`required_timestamp`.`value`, 14, 1) <> ':'
				OR substr(`required_timestamp`.`value`, 15, 2)
					NOT GLOB '[0-9][0-9]'
				OR CAST(substr(`required_timestamp`.`value`, 15, 2) AS integer)
					NOT BETWEEN 0 AND 59
				OR NOT (
					(
						length(`required_timestamp`.`value`) = 17
						AND substr(`required_timestamp`.`value`, 17, 1) = 'Z'
					)
					OR (
						length(`required_timestamp`.`value`) = 21
						AND substr(`required_timestamp`.`value`, 17, 1) IN ('+', '-')
						AND substr(`required_timestamp`.`value`, 18, 4)
							GLOB '[0-9][0-9][0-9][0-9]'
					)
					OR (
						length(`required_timestamp`.`value`) = 22
						AND substr(`required_timestamp`.`value`, 17, 1) IN ('+', '-')
						AND substr(`required_timestamp`.`value`, 18, 2)
							GLOB '[0-9][0-9]'
						AND substr(`required_timestamp`.`value`, 20, 1) = ':'
						AND substr(`required_timestamp`.`value`, 21, 2)
							GLOB '[0-9][0-9]'
					)
					OR (
						substr(`required_timestamp`.`value`, 17, 1) = ':'
						AND substr(`required_timestamp`.`value`, 18, 2)
							GLOB '[0-9][0-9]'
						AND CAST(substr(`required_timestamp`.`value`, 18, 2) AS integer)
							BETWEEN 0 AND 59
						AND (
							(
								length(`required_timestamp`.`value`) = 20
								AND substr(`required_timestamp`.`value`, 20, 1) = 'Z'
							)
							OR (
								length(`required_timestamp`.`value`) = 24
								AND substr(`required_timestamp`.`value`, 20, 1) IN ('+', '-')
								AND substr(`required_timestamp`.`value`, 21, 4)
									GLOB '[0-9][0-9][0-9][0-9]'
							)
							OR (
								length(`required_timestamp`.`value`) = 25
								AND substr(`required_timestamp`.`value`, 20, 1) IN ('+', '-')
								AND substr(`required_timestamp`.`value`, 21, 2)
									GLOB '[0-9][0-9]'
								AND substr(`required_timestamp`.`value`, 23, 1) = ':'
								AND substr(`required_timestamp`.`value`, 24, 2)
									GLOB '[0-9][0-9]'
							)
							OR (
								substr(`required_timestamp`.`value`, 20, 1) = '.'
								AND (
									(
										length(`required_timestamp`.`value`) >= 22
										AND substr(`required_timestamp`.`value`, -1, 1) = 'Z'
										AND substr(
											`required_timestamp`.`value`, 21,
											length(`required_timestamp`.`value`) - 21
										) NOT GLOB '*[^0-9]*'
									)
									OR (
										length(`required_timestamp`.`value`) >= 26
										AND substr(`required_timestamp`.`value`, -5, 1) IN ('+', '-')
										AND substr(`required_timestamp`.`value`, -4, 4)
											GLOB '[0-9][0-9][0-9][0-9]'
										AND substr(
											`required_timestamp`.`value`, 21,
											length(`required_timestamp`.`value`) - 25
										) NOT GLOB '*[^0-9]*'
									)
									OR (
										length(`required_timestamp`.`value`) >= 27
										AND substr(`required_timestamp`.`value`, -6, 1) IN ('+', '-')
										AND substr(`required_timestamp`.`value`, -5, 2)
											GLOB '[0-9][0-9]'
										AND substr(`required_timestamp`.`value`, -3, 1) = ':'
										AND substr(`required_timestamp`.`value`, -2, 2)
											GLOB '[0-9][0-9]'
										AND substr(
											`required_timestamp`.`value`, 21,
											length(`required_timestamp`.`value`) - 26
										) NOT GLOB '*[^0-9]*'
									)
								)
							)
						)
					)
				)
		)
		AND json_type(`state`, '$.reason') = 'text'
		AND length(trim(json_extract(`state`, '$.reason'))) BETWEEN 1 AND 500
		AND CASE json_extract(`state`, '$.kind')
			WHEN 'Scheduled' THEN 1
			WHEN 'CheckedIn' THEN 1
			WHEN 'InExamination' THEN
				json_type(`state`, '$.veterinarianId') = 'text'
				AND length(json_extract(`state`, '$.veterinarianId')) = 36
				AND substr(json_extract(`state`, '$.veterinarianId'), 9, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 14, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 19, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 24, 1) = '-'
				AND length(replace(json_extract(`state`, '$.veterinarianId'), '-', '')) = 32
				AND lower(replace(json_extract(`state`, '$.veterinarianId'), '-', ''))
					NOT GLOB '*[^0-9a-f]*'
			WHEN 'AwaitingPayment' THEN
				json_type(`state`, '$.veterinarianId') = 'text'
				AND length(json_extract(`state`, '$.veterinarianId')) = 36
				AND substr(json_extract(`state`, '$.veterinarianId'), 9, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 14, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 19, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 24, 1) = '-'
				AND length(replace(json_extract(`state`, '$.veterinarianId'), '-', '')) = 32
				AND lower(replace(json_extract(`state`, '$.veterinarianId'), '-', ''))
					NOT GLOB '*[^0-9a-f]*'
				AND json_type(`state`, '$.examId') = 'text'
				AND length(json_extract(`state`, '$.examId')) = 36
				AND substr(json_extract(`state`, '$.examId'), 9, 1) = '-'
				AND substr(json_extract(`state`, '$.examId'), 14, 1) = '-'
				AND substr(json_extract(`state`, '$.examId'), 19, 1) = '-'
				AND substr(json_extract(`state`, '$.examId'), 24, 1) = '-'
				AND length(replace(json_extract(`state`, '$.examId'), '-', '')) = 32
				AND lower(replace(json_extract(`state`, '$.examId'), '-', ''))
					NOT GLOB '*[^0-9a-f]*'
			WHEN 'Paid' THEN
				json_type(`state`, '$.veterinarianId') = 'text'
				AND length(json_extract(`state`, '$.veterinarianId')) = 36
				AND substr(json_extract(`state`, '$.veterinarianId'), 9, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 14, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 19, 1) = '-'
				AND substr(json_extract(`state`, '$.veterinarianId'), 24, 1) = '-'
				AND length(replace(json_extract(`state`, '$.veterinarianId'), '-', '')) = 32
				AND lower(replace(json_extract(`state`, '$.veterinarianId'), '-', ''))
					NOT GLOB '*[^0-9a-f]*'
				AND json_type(`state`, '$.examId') = 'text'
				AND length(json_extract(`state`, '$.examId')) = 36
				AND substr(json_extract(`state`, '$.examId'), 9, 1) = '-'
				AND substr(json_extract(`state`, '$.examId'), 14, 1) = '-'
				AND substr(json_extract(`state`, '$.examId'), 19, 1) = '-'
				AND substr(json_extract(`state`, '$.examId'), 24, 1) = '-'
				AND length(replace(json_extract(`state`, '$.examId'), '-', '')) = 32
				AND lower(replace(json_extract(`state`, '$.examId'), '-', ''))
					NOT GLOB '*[^0-9a-f]*'
				AND json_type(`state`, '$.diagnosis') = 'text'
				AND length(trim(json_extract(`state`, '$.diagnosis'))) BETWEEN 1 AND 500
				AND json_type(`state`, '$.treatment') = 'text'
				AND length(trim(json_extract(`state`, '$.treatment'))) BETWEEN 1 AND 500
				AND json_type(`state`, '$.amount') = 'integer'
				AND json_extract(`state`, '$.amount') > 0
			WHEN 'Canceled' THEN 1
			ELSE 0
		END
	), 0) <> 1
) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE `_0006_legacy_appointment_validation`;
--> statement-breakpoint
DROP VIEW `_0006_legacy_appointment_states`;
--> statement-breakpoint
ALTER TABLE `appointments` RENAME TO `appointments_legacy`;
--> statement-breakpoint
CREATE TABLE `appointments` (
	`appointment_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`owner_id` text NOT NULL,
	`pet_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`service_code` text NOT NULL,
	`booking_kind` text NOT NULL,
	`assigned_veterinarian_id` text,
	`reception_note` text,
	`settlement_status` text NOT NULL,
	`deposit_amount` integer,
	`version` integer NOT NULL,
	`state` text NOT NULL
);
--> statement-breakpoint
WITH `migrated_appointments` AS (
	SELECT
		`appointment_id`,
		`status`,
		`owner_id`,
		`pet_id`,
		json_extract(`state`, '$.scheduledAt') AS `scheduled_at`,
		30 AS `duration_minutes`,
		'GeneralConsultation' AS `service_code`,
		'Reserved' AS `booking_kind`,
		CASE
			WHEN `status` IN ('InExamination', 'AwaitingPayment', 'Paid')
				THEN json_extract(`state`, '$.veterinarianId')
			ELSE NULL
		END AS `assigned_veterinarian_id`,
		NULL AS `reception_note`,
		CASE WHEN `status` = 'Paid' THEN 'Settled' ELSE 'NoPayment' END
			AS `settlement_status`,
		CASE WHEN `status` = 'Paid' THEN 0 ELSE NULL END AS `deposit_amount`,
		1 AS `version`,
		CASE WHEN `status` = 'Canceled' THEN json_set(
			json_remove(
				`state`,
				'$.reason',
				'$.veterinarianId',
				'$.amount',
				'$.paidAt'
			),
			'$.durationMinutes', 30,
			'$.serviceCode', 'GeneralConsultation',
			'$.bookingKind', 'Reserved',
			'$.assignedVeterinarianId',
			CASE
				WHEN `status` IN ('InExamination', 'AwaitingPayment', 'Paid')
					THEN json_extract(`state`, '$.veterinarianId')
				ELSE NULL
			END,
			'$.visitReason',
			CASE
				WHEN `status` = 'Canceled' THEN '移行前データ（来院理由不明）'
				ELSE json_extract(`state`, '$.reason')
			END,
			'$.receptionNote', NULL,
			'$.settlement',
			json(
				CASE
					WHEN `status` = 'Paid' THEN json_object(
						'kind', 'Settled',
						'finalAmount', json_extract(`state`, '$.amount'),
						'depositAmount', 0,
						'additionalPaymentAmount', json_extract(`state`, '$.amount'),
						'refundAmount', 0,
						'settledAt', json_extract(`state`, '$.paidAt')
					)
					ELSE json_object('kind', 'NoPayment')
				END
			),
			'$.version', 1,
			'$.cancellationReason',
			CASE
				WHEN `status` = 'Canceled' THEN json_extract(`state`, '$.reason')
				ELSE json_extract(`state`, '$.cancellationReason')
			END
		) ELSE json_remove(json_set(
			json_remove(
				`state`, '$.reason', '$.veterinarianId', '$.amount', '$.paidAt'
			),
			'$.durationMinutes', 30,
			'$.serviceCode', 'GeneralConsultation',
			'$.bookingKind', 'Reserved',
			'$.assignedVeterinarianId', CASE
				WHEN `status` IN ('InExamination', 'AwaitingPayment', 'Paid')
					THEN json_extract(`state`, '$.veterinarianId')
				ELSE NULL
			END,
			'$.visitReason', json_extract(`state`, '$.reason'),
			'$.receptionNote', NULL,
			'$.settlement', json(CASE
				WHEN `status` = 'Paid' THEN json_object(
					'kind', 'Settled',
					'finalAmount', json_extract(`state`, '$.amount'),
					'depositAmount', 0,
					'additionalPaymentAmount', json_extract(`state`, '$.amount'),
					'refundAmount', 0,
					'settledAt', json_extract(`state`, '$.paidAt')
				)
				ELSE json_object('kind', 'NoPayment')
			END),
			'$.version', 1
		), '$.cancellationReason') END AS `state`
	FROM `appointments_legacy`
)
INSERT INTO `appointments` (
	`appointment_id`, `status`, `owner_id`, `pet_id`, `scheduled_at`,
	`duration_minutes`, `service_code`, `booking_kind`,
	`assigned_veterinarian_id`, `reception_note`, `settlement_status`,
	`deposit_amount`, `version`, `state`
)
SELECT
	`appointment_id`, `status`, `owner_id`, `pet_id`, `scheduled_at`,
	`duration_minutes`, `service_code`, `booking_kind`,
	`assigned_veterinarian_id`, `reception_note`, `settlement_status`,
	`deposit_amount`, `version`, `state`
FROM `migrated_appointments`;
--> statement-breakpoint
DROP TABLE `appointments_legacy`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `domain_event_payloads_append_only_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `domain_event_sensitive_payloads_append_only_update`;
--> statement-breakpoint
UPDATE `domain_event_payloads`
SET `aggregate_state` = CASE

	WHEN json_extract(`aggregate_state`, '$.kind') = 'Canceled' THEN json_set(
	json_remove(
		`aggregate_state`, '$.reason', '$.veterinarianId', '$.amount', '$.paidAt'
	),
	'$.durationMinutes', 30,
	'$.serviceCode', 'GeneralConsultation',
	'$.bookingKind', 'Reserved',
	'$.assignedVeterinarianId', CASE
		WHEN json_extract(`aggregate_state`, '$.kind') IN ('InExamination', 'AwaitingPayment', 'Paid')
			THEN json_extract(`aggregate_state`, '$.veterinarianId')
		ELSE NULL
	END,
	'$.visitReason', CASE
		WHEN json_extract(`aggregate_state`, '$.kind') = 'Canceled'
			THEN '移行前データ（来院理由不明）'
		ELSE json_extract(`aggregate_state`, '$.reason')
	END,
	'$.receptionNote', NULL,
	'$.settlement', json(CASE
		WHEN json_extract(`aggregate_state`, '$.kind') = 'Paid' THEN json_object(
			'kind', 'Settled',
			'finalAmount', json_extract(`aggregate_state`, '$.amount'),
			'depositAmount', 0,
			'additionalPaymentAmount', json_extract(`aggregate_state`, '$.amount'),
			'refundAmount', 0,
			'settledAt', json_extract(`aggregate_state`, '$.paidAt')
		)
		ELSE json_object('kind', 'NoPayment')
	END),
	'$.version', 1,
	'$.cancellationReason', CASE
		WHEN json_extract(`aggregate_state`, '$.kind') = 'Canceled'
			THEN json_extract(`aggregate_state`, '$.reason')
		ELSE json_extract(`aggregate_state`, '$.cancellationReason')
	END
)
	ELSE json_remove(json_set(
		json_remove(
			`aggregate_state`, '$.reason', '$.veterinarianId', '$.amount', '$.paidAt'
		),
		'$.durationMinutes', 30,
		'$.serviceCode', 'GeneralConsultation',
		'$.bookingKind', 'Reserved',
		'$.assignedVeterinarianId', CASE
			WHEN json_extract(`aggregate_state`, '$.kind') IN ('InExamination', 'AwaitingPayment', 'Paid')
				THEN json_extract(`aggregate_state`, '$.veterinarianId')
			ELSE NULL
		END,
		'$.visitReason', json_extract(`aggregate_state`, '$.reason'),
		'$.receptionNote', NULL,
		'$.settlement', json(CASE
			WHEN json_extract(`aggregate_state`, '$.kind') = 'Paid' THEN json_object(
				'kind', 'Settled',
				'finalAmount', json_extract(`aggregate_state`, '$.amount'),
				'depositAmount', 0,
				'additionalPaymentAmount', json_extract(`aggregate_state`, '$.amount'),
				'refundAmount', 0,
				'settledAt', json_extract(`aggregate_state`, '$.paidAt')
			)
			ELSE json_object('kind', 'NoPayment')
		END),
		'$.version', 1
	), '$.cancellationReason')
END
WHERE `event_id` IN (
	SELECT `event_id` FROM `domain_events` WHERE `aggregate_name` = 'Appointment'
)
	AND `aggregate_state` IS NOT NULL
	AND json_valid(`aggregate_state`)
	AND json_extract(`aggregate_state`, '$.kind') IN (
		'Scheduled', 'CheckedIn', 'InExamination', 'AwaitingPayment', 'Paid', 'Canceled'
	);
--> statement-breakpoint
UPDATE `domain_event_sensitive_payloads`
SET `aggregate_state` = CASE
	WHEN json_extract(`aggregate_state`, '$.kind') = 'Canceled' THEN json_set(
	json_remove(
		`aggregate_state`, '$.reason', '$.veterinarianId', '$.amount', '$.paidAt'
	),
	'$.durationMinutes', 30,
	'$.serviceCode', 'GeneralConsultation',
	'$.bookingKind', 'Reserved',
	'$.assignedVeterinarianId', CASE
		WHEN json_extract(`aggregate_state`, '$.kind') IN ('InExamination', 'AwaitingPayment', 'Paid')
			THEN json_extract(`aggregate_state`, '$.veterinarianId')
		ELSE NULL
	END,
	'$.visitReason', CASE
		WHEN json_extract(`aggregate_state`, '$.kind') = 'Canceled'
			THEN '移行前データ（来院理由不明）'
		ELSE json_extract(`aggregate_state`, '$.reason')
	END,
	'$.receptionNote', NULL,
	'$.settlement', json(CASE
		WHEN json_extract(`aggregate_state`, '$.kind') = 'Paid' THEN json_object(
			'kind', 'Settled',
			'finalAmount', json_extract(`aggregate_state`, '$.amount'),
			'depositAmount', 0,
			'additionalPaymentAmount', json_extract(`aggregate_state`, '$.amount'),
			'refundAmount', 0,
			'settledAt', json_extract(`aggregate_state`, '$.paidAt')
		)
		ELSE json_object('kind', 'NoPayment')
	END),
	'$.version', 1,
	'$.cancellationReason', CASE
		WHEN json_extract(`aggregate_state`, '$.kind') = 'Canceled'
			THEN json_extract(`aggregate_state`, '$.reason')
		ELSE json_extract(`aggregate_state`, '$.cancellationReason')
	END
)
	ELSE json_remove(json_set(
		json_remove(
			`aggregate_state`, '$.reason', '$.veterinarianId', '$.amount', '$.paidAt'
		),
		'$.durationMinutes', 30,
		'$.serviceCode', 'GeneralConsultation',
		'$.bookingKind', 'Reserved',
		'$.assignedVeterinarianId', CASE
			WHEN json_extract(`aggregate_state`, '$.kind') IN ('InExamination', 'AwaitingPayment', 'Paid')
				THEN json_extract(`aggregate_state`, '$.veterinarianId')
			ELSE NULL
		END,
		'$.visitReason', json_extract(`aggregate_state`, '$.reason'),
		'$.receptionNote', NULL,
		'$.settlement', json(CASE
			WHEN json_extract(`aggregate_state`, '$.kind') = 'Paid' THEN json_object(
				'kind', 'Settled',
				'finalAmount', json_extract(`aggregate_state`, '$.amount'),
				'depositAmount', 0,
				'additionalPaymentAmount', json_extract(`aggregate_state`, '$.amount'),
				'refundAmount', 0,
				'settledAt', json_extract(`aggregate_state`, '$.paidAt')
			)
			ELSE json_object('kind', 'NoPayment')
		END),
		'$.version', 1
	), '$.cancellationReason')
END
WHERE `event_id` IN (
	SELECT `event_id` FROM `domain_events` WHERE `aggregate_name` = 'Appointment'
)
	AND `aggregate_state` IS NOT NULL
	AND json_valid(`aggregate_state`)
	AND json_extract(`aggregate_state`, '$.kind') IN (
		'Scheduled', 'CheckedIn', 'InExamination', 'AwaitingPayment', 'Paid', 'Canceled'
	);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `domain_event_payloads_append_only_update`
BEFORE UPDATE ON `domain_event_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_payloads is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `domain_event_sensitive_payloads_append_only_update`
BEFORE UPDATE ON `domain_event_sensitive_payloads`
BEGIN
	SELECT RAISE(ABORT, 'domain_event_sensitive_payloads is append-only');
END;
