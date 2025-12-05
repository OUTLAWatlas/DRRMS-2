CREATE TABLE `distribution_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` integer NOT NULL,
	`warehouse_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`destination` text NOT NULL,
	`request_id` integer,
	`notes` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `resource_transfers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` integer NOT NULL,
	`from_warehouse_id` integer,
	`to_warehouse_id` integer,
	`quantity` integer NOT NULL,
	`note` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `resources` ADD `unit` text DEFAULT 'units' NOT NULL;--> statement-breakpoint
ALTER TABLE `resources` ADD `reorder_level` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_approved` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouses` ADD `capacity` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `warehouses` ADD `last_audited_at` integer;