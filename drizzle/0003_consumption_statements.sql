-- Consumption statements (RA bill format) — replaces material calculation history
CREATE TABLE `consumption_statements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(20) NOT NULL,
	`raBillNo` varchar(60) NOT NULL,
	`rows` json NOT NULL DEFAULT ('[]'),
	`norms` json NOT NULL DEFAULT ('{}'),
	`royaltyRates` json NOT NULL DEFAULT ('{}'),
	`remarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consumption_statements_id` PRIMARY KEY(`id`)
);
