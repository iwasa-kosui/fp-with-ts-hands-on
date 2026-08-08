CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`veterinarian_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `owners` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pets` (
	`pet_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`species` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`owner_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`appointment_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`owner_id` text,
	`pet_id` text,
	`state` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exam_results` (
	`exam_id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`state` text NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`pet_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `domain_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`aggregate_id` text NOT NULL,
	`aggregate_name` text NOT NULL,
	`aggregate_state` text,
	`event_name` text NOT NULL,
	`event_payload` text NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_user_id` text NOT NULL
);
