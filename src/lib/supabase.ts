import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client-side Supabase client (with RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (bypasses RLS - use carefully!)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// Database types
export interface User {
  id: string;
  wallet_address: string;
  points: number;
  nft_count: number;
  last_claim?: string;
  created_at: string;
  updated_at: string;
}

export interface Raffle {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  points_per_ticket: number;
  max_tickets_per_user: number;
  end_date: string;
  is_active: boolean;
  created_at: string;
  user_ticket_count?: number;
}

export interface RaffleEntry {
  id: string;
  wallet_address: string;
  raffle_id: string;
  ticket_count: number;
  points_spent: number;
  created_at: string;
}

export interface Admin {
  id: string;
  wallet_address: string;
  created_at: string;
  created_by?: string;
  is_active: boolean;
}