'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useAccount } from 'wagmi';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const { data: session } = useSession();
  const { address } = useAccount();
  const [users, setUsers] = useState([]);
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [showCreateRaffle, setShowCreateRaffle] = useState(false);

  // Get wallet address
  const walletAddress = address || session?.address || '';

  // Fetch users
  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users?page=${page}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setTotalUsers(data.total);
        setCurrentPage(data.page);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch raffles
  const fetchRaffles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/raffles');
      if (response.ok) {
        const data = await response.json();
        setRaffles(data);
      }
    } catch (error) {
      console.error('Error fetching raffles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle user block
  const toggleUserBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_block',
          userId,
          blocked: !currentBlocked
        })
      });

      if (response.ok) {
        fetchUsers(currentPage);
      }
    } catch (error) {
      console.error('Error toggling user block:', error);
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          userId
        })
      });

      if (response.ok) {
        fetchUsers(currentPage);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // Toggle raffle
  const toggleRaffle = async (raffleId: string, currentActive: boolean) => {
    try {
      const response = await fetch('/api/admin/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          raffleId,
          isActive: !currentActive
        })
      });

      if (response.ok) {
        fetchRaffles();
      }
    } catch (error) {
      console.error('Error toggling raffle:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'raffles') {
      fetchRaffles();
    }
  }, [activeTab]);

  const handleLogout = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="text-2xl font-bold text-white">
              🛡️ Admin Panel
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : 'No wallet'}
              </div>
              <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                ADMIN
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-black/10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['users', 'raffles'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-gray-300 hover:text-white hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-white">User Management</h1>
              <div className="text-sm text-gray-300">
                Total Users: {totalUsers}
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
                <p className="text-white">Loading users...</p>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left text-gray-300 py-3 px-4">Wallet Address</th>
                        <th className="text-left text-gray-300 py-3 px-4">Points</th>
                        <th className="text-left text-gray-300 py-3 px-4">NFTs</th>
                        <th className="text-left text-gray-300 py-3 px-4">Created</th>
                        <th className="text-left text-gray-300 py-3 px-4">Status</th>
                        <th className="text-left text-gray-300 py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user: any) => (
                        <tr key={user.id} className="border-b border-white/10">
                          <td className="py-3 px-4 text-gray-300 font-mono text-sm">
                            {user.wallet_address.slice(0, 12)}...{user.wallet_address.slice(-8)}
                          </td>
                          <td className="py-3 px-4 text-purple-400 font-medium">{user.points}</td>
                          <td className="py-3 px-4 text-blue-400">{user.nft_count}</td>
                          <td className="py-3 px-4 text-gray-300 text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.points < 0 
                                ? 'bg-red-500 text-white' 
                                : 'bg-green-500 text-white'
                            }`}>
                              {user.points < 0 ? 'Blocked' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => toggleUserBlock(user.id, user.points < 0)}
                                className={`px-3 py-1 rounded text-xs font-medium ${
                                  user.points < 0
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                }`}
                              >
                                {user.points < 0 ? 'Unblock' : 'Block'}
                              </button>
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                <div className="flex justify-between items-center p-4 border-t border-white/10">
                  <button
                    onClick={() => fetchUsers(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm"
                  >
                    Previous
                  </button>
                  <span className="text-white">Page {currentPage}</span>
                  <button
                    onClick={() => fetchUsers(currentPage + 1)}
                    disabled={users.length < 20}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'raffles' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-white">Raffle Management</h1>
              <button
                onClick={() => setShowCreateRaffle(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                Create Raffle
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
                <p className="text-white">Loading raffles...</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {raffles.map((raffle: any) => (
                  <div key={raffle.id} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-2">{raffle.title}</h3>
                    <p className="text-gray-300 text-sm mb-4">{raffle.description}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-400">
                        <span>Points per ticket:</span>
                        <span>{raffle.points_per_ticket}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Max tickets:</span>
                        <span>{raffle.max_tickets_per_user}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>End date:</span>
                        <span>{new Date(raffle.end_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Status:</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          raffle.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {raffle.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => toggleRaffle(raffle.id, raffle.is_active)}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                          raffle.is_active
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {raffle.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}