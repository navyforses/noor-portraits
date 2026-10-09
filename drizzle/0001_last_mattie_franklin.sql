CREATE TABLE `analytics_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text NOT NULL,
	`campaign` text NOT NULL,
	`mode` text DEFAULT 'demo' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_costs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `order_id` text;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `package_id` text;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `style_id` text;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `mode` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `analytics_session_id` text;