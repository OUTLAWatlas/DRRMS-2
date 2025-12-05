CREATE TABLE `request_event_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer,
	`event_type` text NOT NULL,
	`payload` text,
	`actor_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `rescue_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `request_event_log_request_idx` ON `request_event_log` (`request_id`);
--> statement-breakpoint
CREATE TABLE `demand_feature_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bucket_start` integer NOT NULL,
	`bucket_end` integer NOT NULL,
	`region` text NOT NULL,
	`resource_type` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`pending_count` integer DEFAULT 0 NOT NULL,
	`in_progress_count` integer DEFAULT 0 NOT NULL,
	`fulfilled_count` integer DEFAULT 0 NOT NULL,
	`cancelled_count` integer DEFAULT 0 NOT NULL,
	`avg_people` real,
	`avg_severity_score` real,
	`median_wait_mins` real,
	`inventory_available` integer,
	`open_allocations` integer,
	`weather_alert_level` text,
	`precipitation_mm` real,
	`wind_speed_kph` real,
	`humidity` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demand_feature_snapshots_bucket_idx` ON `demand_feature_snapshots` (`bucket_start`, `region`, `resource_type`);
--> statement-breakpoint
CREATE TABLE `request_feature_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`snapshot_at` integer NOT NULL,
	`people_count` integer,
	`priority` text,
	`severity_score` real,
	`weather_layer` text,
	`travel_time_minutes` real,
	`supply_pressure` real,
	`model_features` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `rescue_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `predictive_model_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_name` text NOT NULL,
	`version` text NOT NULL,
	`run_type` text DEFAULT 'inference' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`metrics_json` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predictive_recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer,
	`region` text,
	`resource_type` text NOT NULL,
	`suggested_quantity` integer NOT NULL,
	`confidence` real,
	`impact_score` real,
	`lead_time_minutes` integer,
	`status` text DEFAULT 'suggested' NOT NULL,
	`rationale` text,
	`model_run_id` integer,
	`feature_snapshot_id` integer,
	`valid_from` integer NOT NULL,
	`valid_until` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `rescue_requests`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`model_run_id`) REFERENCES `predictive_model_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`feature_snapshot_id`) REFERENCES `request_feature_snapshots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `predictive_recommendations_status_idx` ON `predictive_recommendations` (`status`);
--> statement-breakpoint
CREATE TABLE `predictive_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recommendation_id` integer NOT NULL,
	`action` text NOT NULL,
	`actor_id` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`recommendation_id`) REFERENCES `predictive_recommendations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `predictive_feedback_recommendation_idx` ON `predictive_feedback` (`recommendation_id`);
