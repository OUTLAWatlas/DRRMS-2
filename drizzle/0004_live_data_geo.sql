ALTER TABLE `rescue_requests` ADD COLUMN `latitude` real;
--> statement-breakpoint
ALTER TABLE `rescue_requests` ADD COLUMN `longitude` real;
--> statement-breakpoint
ALTER TABLE `warehouses` ADD COLUMN `latitude` real;
--> statement-breakpoint
ALTER TABLE `warehouses` ADD COLUMN `longitude` real;
--> statement-breakpoint
ALTER TABLE `distribution_logs` ADD COLUMN `latitude` real;
--> statement-breakpoint
ALTER TABLE `distribution_logs` ADD COLUMN `longitude` real;
--> statement-breakpoint
ALTER TABLE `resource_allocations` ADD COLUMN `latitude` real;
--> statement-breakpoint
ALTER TABLE `resource_allocations` ADD COLUMN `longitude` real;
--> statement-breakpoint
CREATE TABLE `live_weather_readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`location_name` text NOT NULL,
	`temperature_c` real,
	`wind_speed_kph` real,
	`humidity` integer,
	`precipitation_mm` real,
	`condition` text,
	`alert_level` text DEFAULT 'normal' NOT NULL,
	`source` text DEFAULT 'mock' NOT NULL,
	`recorded_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `government_alerts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`headline` text NOT NULL,
	`area` text,
	`severity` text,
	`certainty` text,
	`urgency` text,
	`source` text DEFAULT 'mock' NOT NULL,
	`issued_at` integer,
	`expires_at` integer,
	`summary` text,
	`raw_payload` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT `government_alerts_external_id_idx` UNIQUE(`external_id`)
);
