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
  id: number;
  title: string;
  description: string;
  image_url?: string;
  points_per_ticket: number;
  max_tickets_per_user: number;
  max_participants?: number;
  end_date: string;
  created_at: string;
  user_ticket_count?: number;
  current_participants?: number;
  prize_token_address?: string;
  prize_token_type?: 'NFT' | 'ERC20';
  prize_token_id?: string;
  prize_amount?: string;
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