-- Migration: Safely change raffle ID from UUID to INTEGER
-- Handles foreign key dependencies properly
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the foreign key constraint from entries table
ALTER TABLE shellies_raffle_entries DROP CONSTRAINT shellies_raffle_entries_raffle_id_fkey;

-- Step 2: Drop the entries table raffle_id column (will recreate it)
ALTER TABLE shellies_raffle_entries DROP COLUMN raffle_id;

-- Step 3: Drop the primary key constraint from raffles table
ALTER TABLE shellies_raffle_raffles DROP CONSTRAINT shellies_raffle_raffles_pkey;

-- Step 4: Drop the UUID id column from raffles table
ALTER TABLE shellies_raffle_raffles DROP COLUMN id;

-- Step 5: Add new integer id column as primary key to raffles table
ALTER TABLE shellies_raffle_raffles ADD COLUMN id SERIAL PRIMARY KEY;

-- Step 6: Add new integer raffle_id column to entries table
ALTER TABLE shellies_raffle_entries ADD COLUMN raffle_id INTEGER NOT NULL DEFAULT 1;

-- Step 7: Recreate the foreign key constraint
ALTER TABLE shellies_raffle_entries 
ADD CONSTRAINT shellies_raffle_entries_raffle_id_fkey 
FOREIGN KEY (raffle_id) REFERENCES shellies_raffle_raffles(id) ON DELETE CASCADE;

-- Done! Now both tables use integer IDs that work with smart contracts