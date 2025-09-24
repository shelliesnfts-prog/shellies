// Jest setup file for global test configuration

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_RAFFLE_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

// Global test utilities
global.mockRaffle = {
  id: 1,
  title: 'Test Raffle',
  points_per_ticket: 100,
  max_tickets_per_user: 10,
  max_participants: 100,
  current_participants: 5,
  end_date: new Date(Date.now() + 86400000).toISOString(),
  status: 'ACTIVE'
};

global.mockUser = {
  id: 'user-123',
  wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
  points: 1000,
  nft_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};