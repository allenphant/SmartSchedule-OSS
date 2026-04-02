-- Add auto_lock_scheduling column to stores table
ALTER TABLE stores ADD COLUMN auto_lock_scheduling BOOLEAN NOT NULL DEFAULT true;
