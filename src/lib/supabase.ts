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
  points: number; // Now supports decimal values (e.g., 0.1 for regular users)
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
  status?: 'CREATED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'BLOCKCHAIN_FAILED';
  created_at: string;
  user_ticket_count?: number;
  current_participants?: number;
  winner?: string | null;  // Winner's wallet address from blockchain
  prize_token_address?: string;
  prize_token_type?: 'NFT' | 'ERC20';
  prize_token_id?: string;
  prize_amount?: string;
  // New blockchain tracking fields
  blockchain_tx_hash?: string;
  blockchain_deployed_at?: string;
  blockchain_error?: string;
  blockchain_failed_at?: string;
  // Visibility field for hiding raffles from portal
  is_hidden?: boolean;
}

export interface RaffleEntry {
  id: string;
  wallet_address: string;
  raffle_id: string;
  ticket_count: number;
  points_spent: number;
  created_at: string;
  join_tx_hash?: string;
}

export interface Admin {
  id: string;
  wallet_address: string;
  created_at: string;
  created_by?: string;
  is_active: boolean;
}