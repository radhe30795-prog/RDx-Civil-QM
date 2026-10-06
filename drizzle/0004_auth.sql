-- Multi-user auth: users + sessions tables, userId on user-owned data
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(80) NOT NULL,
	`passwordHash` varchar(200) NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` ENUM('admin','user') NOT NULL DEFAULT 'user',
	`isActive` tinyint(1) NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_token_unique` UNIQUE(`token`)
);
ALTER TABLE `projects` ADD `userId` int;
ALTER TABLE `test_entries` ADD `userId` int;
ALTER TABLE `consumption_statements` ADD `userId` int;
CREATE INDEX `projects_userId_idx` ON `projects` (`userId`);
CREATE INDEX `test_entries_userId_idx` ON `test_entries` (`userId`);
CREATE INDEX `consumption_statements_userId_idx` ON `consumption_statements` (`userId`);
