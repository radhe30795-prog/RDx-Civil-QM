CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`packageNo` varchar(80),
	`client` varchar(200),
	`location` varchar(200),
	`remarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`testMasterId` int NOT NULL,
	`testDate` varchar(20) NOT NULL,
	`sampleId` varchar(80),
	`chainage` varchar(60),
	`layer` varchar(120),
	`materialSource` varchar(200),
	`testedBy` varchar(120),
	`witnessBy` varchar(120),
	`inputs` json NOT NULL DEFAULT ('{}'),
	`results` json NOT NULL DEFAULT ('{}'),
	`status` enum('Pass','Fail','Pending') NOT NULL DEFAULT 'Pending',
	`remarks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `test_masters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` varchar(60) NOT NULL,
	`isCode` varchar(120),
	`unit` varchar(40),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `test_masters_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_masters_code_unique` UNIQUE(`code`)
);
