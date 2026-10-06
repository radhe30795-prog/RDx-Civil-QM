-- Add 'Indicative' to test_entries.status enum (for NDT / record-only tests)
ALTER TABLE `test_entries` MODIFY `status` ENUM('Pass','Fail','Pending','Indicative') NOT NULL DEFAULT 'Pending';
