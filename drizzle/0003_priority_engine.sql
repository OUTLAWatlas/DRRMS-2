ALTER TABLE `rescue_requests` ADD COLUMN `criticality_score` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `rescue_requests` ADD COLUMN `last_scored_at` integer;
--> statement-breakpoint
ALTER TABLE `resource_allocations` ADD COLUMN `status` text DEFAULT 'booked' NOT NULL;
--> statement-breakpoint
ALTER TABLE `resource_allocations` ADD COLUMN `notes` text;
--> statement-breakpoint
CREATE TABLE `request_priority_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`severity_weight` integer DEFAULT 0 NOT NULL,
	`people_weight` integer DEFAULT 0 NOT NULL,
	`age_weight` integer DEFAULT 0 NOT NULL,
	`supply_pressure_weight` integer DEFAULT 0 NOT NULL,
	`recommended_resource_id` integer,
	`recommended_warehouse_id` integer,
	`recommended_quantity` integer,
	`rationale` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `rescue_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recommended_resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recommended_warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `allocation_recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`resource_id` integer,
	`warehouse_id` integer,
	`quantity` integer,
	`score` integer NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`rationale` text,
	`applied_allocation_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `rescue_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`applied_allocation_id`) REFERENCES `resource_allocations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `allocation_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`allocation_id` integer,
	`request_id` integer NOT NULL,
	`resource_id` integer NOT NULL,
	`warehouse_id` integer,
	`quantity` integer NOT NULL,
	`event_type` text NOT NULL,
	`note` text,
	`actor_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`allocation_id`) REFERENCES `resource_allocations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `rescue_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`direction` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`description` text,
	`request_id` integer,
	`recorded_by` integer,
	`recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `rescue_requests`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
