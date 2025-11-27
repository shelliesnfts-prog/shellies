import { Users, TrendingUp, Crown } from 'lucide-react';

interface GameStatsCardsProps {
  gameStats: {
    totalPlayers: number;
    averageXP: number;
    topScore: number;
  };
  statsLoading: boolean;
  isDarkMode: boolean;
}

export function GameStatsCards({ gameStats, statsLoading, isDarkMode }: GameStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Players */}
      <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
        isDarkMode
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-500'
          : 'bg-gradient-to-br from-white to-blue-50/30 border-blue-200/60 hover:border-blue-300 shadow-sm'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative p-5">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${
              isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded-full ${
              isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'
            }`}>
              Players
            </div>
          </div>
          <div className="space-y-1">
            <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Players
            </h3>
            {statsLoading ? (
              <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
            ) : (
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {gameStats.totalPlayers}
              </p>
            )}
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Active gamers
            </p>
          </div>
        </div>
      </div>

      {/* Average XP */}
      <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
        isDarkMode
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-green-500'
          : 'bg-gradient-to-br from-white to-green-50/30 border-green-200/60 hover:border-green-300 shadow-sm'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative p-5">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${
              isDarkMode ? 'bg-green-500/20' : 'bg-green-100'
            }`}>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded-full ${
              isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-green-50 text-green-700'
            }`}>
              Average
            </div>
          </div>
          <div className="space-y-1">
            <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Average XP
            </h3>
            {statsLoading ? (
              <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
            ) : (
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {gameStats.averageXP.toFixed(0)}
              </p>
            )}
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Community average
            </p>
          </div>
        </div>
      </div>

      {/* Top XP */}
      <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
        isDarkMode
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-yellow-500'
          : 'bg-gradient-to-br from-white to-yellow-50/30 border-yellow-200/60 hover:border-yellow-300 shadow-sm'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative p-5">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2.5 rounded-xl ${
              isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'
            }`}>
              <Crown className="w-5 h-5 text-yellow-600" />
            </div>
            <div className={`text-xs font-medium px-2 py-1 rounded-full ${
              isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-yellow-50 text-yellow-700'
            }`}>
              Top XP
            </div>
          </div>
          <div className="space-y-1">
            <h3 className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Top XP
            </h3>
            {statsLoading ? (
              <div className={`h-9 rounded animate-pulse w-16 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
            ) : (
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {gameStats.topScore}
              </p>
            )}
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              Highest achievement
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
