# Database Migration Instructions

## How to Run the Migrations

### Step 1: Create Tables
1. **Go to your Supabase dashboard**
2. **Navigate to SQL Editor**
3. **Copy and paste the content from `001_create_shellies_raffle_tables.sql`**
4. **Click "Run" to execute the migration**

### Step 2: Apply Corrected RLS Policies  
1. **Copy and paste the content from `004_corrected_rls_policies.sql`**
2. **Click "Run" to execute the policies**

⚠️ **Important**: 
- Run migration `001` first, then `004`
- Skip migrations `002` and `003` (they had syntax issues)
- You need both migrations for the app to work properly

## What this migration creates:

### Tables:
- `shellies_raffle_users` - User profiles with wallet addresses, points, NFT counts
- `shellies_raffle_raffles` - Raffle configurations and details  
- `shellies_raffle_entries` - User entries in specific raffles

### Features:
- **Indexes** for better query performance
- **Row Level Security (RLS)** policies for data protection
- **Automatic timestamps** with triggers
- **Sample raffle data** to get started

## Verification

After running the migration, you should see:
- 3 new tables in your Supabase database
- 4 sample raffles in the `shellies_raffle_raffles` table
- Proper indexes and RLS policies enabled

## Environment Variables

Make sure you have these in your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```