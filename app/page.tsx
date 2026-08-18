'use client'

import { useState, useEffect } from 'react'

export default function Home() {
  const [playerName, setPlayerName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([])
  const [activeTab, setActiveTab] = useState<'play' | 'leaderboard'>('play')

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 5000)
    // Pre-fill join code if URL has ?join=CODE (from share link)
    const joinParam = new URLSearchParams(window.location.search).get('join')
    if (joinParam) setJoinCode(joinParam.toUpperCase())
    return () => clearInterval(interval)
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard')
      const data = await res.json()
      setLeaderboard(data)
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err)
    }
  }

  const handleCreateGame = () => {
    if (!playerName.trim()) return alert('Please enter your name')
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    localStorage.setItem('playerName', playerName)
    window.location.href = `/game?code=${code}`
  }

  const handleJoinGame = () => {
    if (!playerName.trim()) return alert('Please enter your name')
    if (!joinCode.trim()) return alert('Please enter a game code')
    localStorage.setItem('playerName', playerName)
    window.location.href = `/game?code=${joinCode.trim().toUpperCase()}`
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)' }}>
      {/* Hero */}
      <div className="text-center pt-14 pb-6 px-4">
        <div className="text-6xl mb-3">✏️</div>
        <h1
          className="text-5xl md:text-7xl font-black text-white mb-3 tracking-tight"
          style={{ textShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
        >
          Sowaka Scribble
        </h1>
        <p className="text-lg text-purple-100 font-semibold">Draw • Guess • Win!</p>
        <div className="flex justify-center gap-10 mt-5">
          {[['✏️', 'Draw'], ['🤔', 'Guess'], ['🏆', 'Win']].map(([emoji, label]) => (
            <div key={label} className="text-center">
              <span className="text-2xl">{emoji}</span>
              <p className="text-purple-200 text-xs font-bold mt-1 uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tab container */}
      <div className="max-w-md mx-auto px-4 pb-12">
        {/* Tab bar */}
        <div className="flex bg-white bg-opacity-15 rounded-2xl p-1 mb-5">
          {(['play', 'leaderboard'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab
                  ? 'bg-white text-purple-700 shadow-md'
                  : 'text-white hover:bg-white hover:bg-opacity-10'
              }`}
            >
              {tab === 'play' ? '🎮 Play Game' : '🏆 Leaderboard'}
            </button>
          ))}
        </div>

        {/* Play tab */}
        {activeTab === 'play' && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #4f46e5, #ec4899)' }} />
            <div className="p-8">
              <h2 className="text-xl font-black text-gray-800 mb-5">Join the Fun!</h2>

              <div className="mb-5">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3.5 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-purple-400 transition text-gray-800 font-semibold text-base"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateGame()}
                />
              </div>

              <button
                onClick={handleCreateGame}
                className="w-full py-4 rounded-2xl font-black text-lg text-white mb-5 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                ✨ Create New Game
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-bold">or join existing</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="GAME CODE"
                  maxLength={8}
                  className="flex-1 px-4 py-3.5 border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-pink-400 transition text-gray-800 font-black tracking-widest text-center uppercase"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
                />
                <button
                  onClick={handleJoinGame}
                  className="px-6 py-3.5 rounded-2xl font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-md whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #ec4899, #f59e0b)' }}
                >
                  Join →
                </button>
              </div>

              <p className="text-center text-xs text-gray-300 mt-6 font-medium">
                2–10 players · 90 seconds per round · No login required
              </p>
            </div>
          </div>
        )}

        {/* Leaderboard tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-gray-800">Weekly Top 10</h2>
                <button
                  onClick={fetchLeaderboard}
                  className="text-sm font-bold text-purple-400 hover:text-purple-600 transition"
                >
                  ↻ Refresh
                </button>
              </div>

              {leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((player, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl ${
                        idx === 0 ? 'bg-yellow-50 border-2 border-yellow-200' :
                        idx === 1 ? 'bg-gray-50 border-2 border-gray-200' :
                        idx === 2 ? 'bg-orange-50 border-2 border-orange-100' :
                        'bg-gray-50 border border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl w-8 text-center">
                          {idx < 3 ? medals[idx] : `${idx + 1}`}
                        </span>
                        <span className={`font-bold ${idx < 3 ? 'text-gray-900' : 'text-gray-600 text-sm'}`}>
                          {player.name}
                        </span>
                      </div>
                      <span className={`font-black ${
                        idx === 0 ? 'text-yellow-600 text-lg' :
                        idx === 1 ? 'text-gray-400 text-base' :
                        idx === 2 ? 'text-orange-500 text-base' :
                        'text-purple-500 text-sm'
                      }`}>
                        {player.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-5xl block mb-3">🎮</span>
                  <p className="text-gray-400 font-medium">No scores yet — be the first!</p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-purple-200 text-xs mt-6 font-medium">
          Built for Sowaka · Employee Engagement & Wellness
        </p>
      </div>
    </main>
  )
}
