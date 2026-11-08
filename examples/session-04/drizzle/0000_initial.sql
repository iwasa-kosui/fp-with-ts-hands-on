CREATE TABLE `appointments` (
  `appointment_id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `pet_id` text NOT NULL,
  `status` text NOT NULL,
  `state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
  `event_id` text PRIMARY KEY NOT NULL,
  `appointment_id` text NOT NULL,
  `event_name` text NOT NULL,
  `payload` text NOT NULL,
  `occurred_at` text NOT NULL
);
