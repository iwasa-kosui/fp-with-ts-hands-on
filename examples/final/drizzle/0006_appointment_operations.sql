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
