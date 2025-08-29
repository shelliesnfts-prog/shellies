import { supabase, supabaseAdmin, User, Raffle } from './supabase';

export class AdminService {
  // Check if a wallet address is an admin
  static async isAdmin(walletAddress: string): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      const { data, error } = await client
        .from('shellies_raffle_admins')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Unexpected error checking admin:', error);
      return false;
    }
  }

  // Get all users with pagination
  static async getAllUsers(page: number = 1, limit: number = 20): Promise<{ users: User[], total: number }> {
    try {
      const client = supabaseAdmin || supabase;
      const offset = (page - 1) * limit;

      // Get total count
      const { count } = await client
        .from('shellies_raffle_users')
        .select('*', { count: 'exact', head: true });

      // Get paginated users
      const { data: users, error } = await client
        .from('shellies_raffle_users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching users:', error);
        return { users: [], total: 0 };
      }

      return { users: users || [], total: count || 0 };
    } catch (error) {
      console.error('Unexpected error fetching users:', error);
      return { users: [], total: 0 };
    }
  }

  // Block/Unblock user (soft delete by setting points to -1 or similar)
  static async toggleUserBlock(userId: string, blocked: boolean): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      // Use a negative points value to indicate blocked status
      const updateData = blocked 
        ? { points: -999999 } // Blocked indicator
        : { points: Math.max(0, Math.abs(Math.floor(Math.random() * 100))) }; // Unblock with random points

      const { error } = await client
        .from('shellies_raffle_users')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('Error toggling user block:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error toggling user block:', error);
      return false;
    }
  }

  // Delete user permanently
  static async deleteUser(userId: string): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error deleting user:', error);
      return false;
    }
  }

  // Get all raffles
  static async getAllRaffles(): Promise<Raffle[]> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { data: raffles, error } = await client
        .from('shellies_raffle_raffles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching raffles:', error);
        return [];
      }

      return raffles || [];
    } catch (error) {
      console.error('Unexpected error fetching raffles:', error);
      return [];
    }
  }

  // Create new raffle
  static async createRaffle(raffleData: {
    title: string;
    description: string;
    image_url?: string;
    points_per_ticket: number;
    max_tickets_per_user: number;
    end_date: string;
  }): Promise<Raffle | null> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { data: raffle, error } = await client
        .from('shellies_raffle_raffles')
        .insert([{
          ...raffleData,
          is_active: true,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating raffle:', error);
        return null;
      }

      return raffle;
    } catch (error) {
      console.error('Unexpected error creating raffle:', error);
      return null;
    }
  }

  // Update raffle
  static async updateRaffle(raffleId: string, raffleData: Partial<Raffle>): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_raffles')
        .update(raffleData)
        .eq('id', raffleId);

      if (error) {
        console.error('Error updating raffle:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error updating raffle:', error);
      return false;
    }
  }

  // Toggle raffle active status
  static async toggleRaffle(raffleId: string, isActive: boolean): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_raffles')
        .update({ is_active: isActive })
        .eq('id', raffleId);

      if (error) {
        console.error('Error toggling raffle:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error toggling raffle:', error);
      return false;
    }
  }

  // Get admin list
  static async getAdmins(): Promise<any[]> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { data: admins, error } = await client
        .from('shellies_raffle_admins')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching admins:', error);
        return [];
      }

      return admins || [];
    } catch (error) {
      console.error('Unexpected error fetching admins:', error);
      return [];
    }
  }

  // Add new admin
  static async addAdmin(walletAddress: string, createdBy: string): Promise<boolean> {
    try {
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from('shellies_raffle_admins')
        .insert([{
          wallet_address: walletAddress,
          created_by: createdBy,
          is_active: true,
        }]);

      if (error) {
        console.error('Error adding admin:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error adding admin:', error);
      return false;
    }
  }
}