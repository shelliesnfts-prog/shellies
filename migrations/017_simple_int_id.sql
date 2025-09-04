-- Migration: Change raffle ID from UUID to INTEGER
-- Simple migration to support smart contract uint256 type
-- Run this in your Supabase SQL Editor

-- Step 1: Drop the existing UUID primary key constraint
ALTER TABLE shellies_raffle_raffles DROP CONSTRAINT shellies_raffle_raffles_pkey;

-- Step 2: Drop the existing id column  
ALTER TABLE shellies_raffle_raffles DROP COLUMN id;

-- Step 3: Add new integer id column as primary key
ALTER TABLE shellies_raffle_raffles ADD COLUMN id SERIAL PRIMARY KEY;

-- Done! Now your raffle table uses integer IDs: 1, 2, 3, 4...