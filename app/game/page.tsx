'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import GameCanvas, { GameCanvasHandle } from '@/components/GameCanvas'
import LeaderboardWidget from '@/components/LeaderboardWidget'

const AVATAR_COLORS = ['#4f46e5', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4']

type Player = { id: string; name: string; score: number }
type Guess = { player: string; guess: string | null; correct: boolean; points: number }

const DURATION_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2m', value: 120 },
]

const DIFFICULTY_OPTIONS = [
  { label: '🐣 Easy', value: 'easy' },
  { label: '🎯 Medium', value: 'medium' },
  { label: '🔥 Hard', value: 'hard' },
]

const ROUNDS_OPTIONS = [
  { label: '1', value: 1 },
  { label: '3', value: 3 },
  { label: '5', value: 5 },
  { label: '10', value: 10 },
]

function GamePageInner() {
  const searchParams = useSearchParams()
  const code = searchParams?.get('code') || ''

  const [playerName, setPlayerName] = useState('')
  const [socketId, setSocketId] = useState('')
  const [gameState, setGameState] = useState('lobby')
  const [players, setPlayers] = useState<Player[]>([])
  const [drawerSocketId, setDrawerSocketId] = useState('')
  const [currentWord, setCurrentWord] = useState<string | null>(null)
  const [wordLength, setWordLength] = useState(0)
  const [hint, setHint] = useState('')
  const [timeLeft, setTimeLeft] = useState(90)
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [roundWord, setRoundWord] = useState('')
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [guessInput, setGuessInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [myGuessCorrect, setMyGuessCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  // lobby settings (host-controlled)
  const [roundDuration, setRoundDuration] = useState(90)
  const [difficulty, setDifficulty] = useState('medium')
  const [totalRounds, setTotalRounds] = useState(3)
  const [currentRound, setCurrentRound] = useState(0)
  const [hostId, setHostId] = useState('')

  const canvasRef = useRef<GameCanvasHandle>(null)
  const socketRef = useRef<Socket | null>(null)
  const guessInputRef = useRef<HTMLInputElement>(null)

  const isDrawing = !!socketId && socketId === drawerSocketId
  const isHost = !!socketId && socketId === hostId
  const scores = Object.fromEntries(players.map(p => [p.name, p.score]))
  const drawerName = players.find(p => p.id === drawerSocketId)?.name || ''

  useEffect(() => {
    const name = localStorage.getItem('playerName')
      || `Player${Math.random().toString(36).slice(2, 5)}`
    setPlayerName(name)
  }, [])

  useEffect(() => {
    if (!playerName || !code) return

    const socket = io()
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketId(socket.id ?? '')
      setConnected(true)
      socket.emit('join-room', { code, name: playerName })
    })

    socket.on('room-update', ({ players, hostId, gameState, drawerIndex, roundDuration, difficulty, totalRounds }: {
      players: Player[]; hostId: string; gameState: string; drawerIndex: number;
      roundDuration: number; difficulty: string; totalRounds: number
    }) => {
      setPlayers(players)
      setHostId(hostId)
      setGameState(gameState)
      setRoundDuration(roundDuration)
      setDifficulty(difficulty)
      if (totalRounds) setTotalRounds(totalRounds)
      if (players[drawerIndex]) setDrawerSocketId(players[drawerIndex].id)
    })

    socket.on('round-started', ({ players, drawerSocketId, word, wordLength, hint, timeLeft, roundDuration, currentRound, totalRounds }: {
      players: Player[]; drawerSocketId: string; word: string | null; wordLength: number;
      hint: string; timeLeft: number; roundDuration: number; currentRound: number; totalRounds: number
    }) => {
      setPlayers(players)
      setDrawerSocketId(drawerSocketId)
      setCurrentWord(word)
      setWordLength(wordLength)
      setHint(hint)
      setTimeLeft(timeLeft)
      setRoundDuration(roundDuration)
      setCurrentRound(currentRound)
      setTotalRounds(totalRounds)
      setGuesses([])
      setGuessInput('')
      setMyGuessCorrect(false)
      setCorrectCount(0)
      setGameState('playing')
    })

    socket.on('game-over', ({ word, players }: { word: string; players: Player[] }) => {
      setRoundWord(word)
      setPlayers(players)
      setGameState('gameover')
    })

    socket.on('timer-tick', ({ timeLeft }: { timeLeft: number }) => {
      setTimeLeft(timeLeft)
    })

    socket.on('hint-update', ({ hint }: { hint: string }) => {
      setHint(hint)
    })

    // Correct canvas clear at round start
    socket.on('canvas-cleared', () => {
      canvasRef.current?.clearCanvas()
    })

    socket.on('guess-made', ({ playerName, guess, correct, points, players }: {
      playerName: string; guess: string | null; correct: boolean; points: number; players: Player[]
    }) => {
      setGuesses(prev => [...prev, { player: playerName, guess, correct, points }])
      setPlayers(players)
      if (correct) setCorrectCount(c => c + 1)
    })

    // Private event to this guesser only when they guess correctly
    socket.on('guess-correct', ({ points, players }: { points: number; players: Player[] }) => {
      setMyGuessCorrect(true)
      setPlayers(players)
      // focus away so they don't accidentally type
      guessInputRef.current?.blur()
    })

    socket.on('round-ended', ({ word, players, currentRound, totalRounds }: { word: string; players: Player[]; currentRound: number; totalRounds: number }) => {
      setRoundWord(word)
      setPlayers(players)
      setCurrentRound(currentRound)
      setTotalRounds(totalRounds)
      setGameState('roundend')
    })

    socket.on('remote-draw', ({ type, xn, yn }: { type: 'start' | 'move' | 'end'; xn: number; yn: number }) => {
      canvasRef.current?.applyStroke(type, xn, yn)
    })

    socket.on('remote-clear', () => {
      canvasRef.current?.clearCanvas()
    })

    socket.on('disconnect', () => setConnected(false))

    return () => { socket.disconnect() }
  }, [playerName, code])

  // Emit settings changes immediately (host only)
  const updateSettings = (newDuration?: number, newDifficulty?: string, newTotalRounds?: number) => {
    socketRef.current?.emit('set-settings', {
      code,
      roundDuration: newDuration ?? roundDuration,
      difficulty: newDifficulty ?? difficulty,
      totalRounds: newTotalRounds ?? totalRounds,
    })
  }

  const handleStartGame = () => socketRef.current?.emit('start-game', { code })
  const handleNextRound = () => socketRef.current?.emit('next-round', { code })

  const handleShareLeaderboard = () => {
    const medals = ['🥇', '🥈', '🥉']
    const sorted = [...players].sort((a, b) => b.score - a.score)
    const lines = sorted.map((p, i) =>
      `${medals[i] ?? `${i + 1}.`} ${p.name} — ${p.score} pts`
    )
    const text = `🏆 Sowaka Scribble Results\n\n${lines.join('\n')}\n\nPlay at: https://game-2-w8ur.onrender.com`
    if (navigator.share) {
      navigator.share({ title: 'Sowaka Scribble Results', text })
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Leaderboard copied to clipboard!'))
    }
  }

  const handleStroke = (type: 'start' | 'move' | 'end', xn: number, yn: number) => {
    socketRef.current?.emit('draw', { code, type, xn, yn })
  }

  const handleClearCanvas = () => {
    canvasRef.current?.clearCanvas()
    socketRef.current?.emit('clear-canvas', { code })
  }

  const handleGuess = () => {
    const guess = guessInput.trim()
    if (!guess || myGuessCorrect) return
    socketRef.current?.emit('make-guess', { code, guess })
    setGuessInput('')
    guessInputRef.current?.focus()
  }

  const timerColor = timeLeft < 10 ? '#ef4444' : timeLeft < 20 ? '#f97316' : '#10b981'
  const timerBg   = timeLeft < 10 ? '#fef2f2' : timeLeft < 20 ? '#fff7ed' : '#f0fdf4'
  const timerPct  = roundDuration > 0 ? (timeLeft / roundDuration) * 100 : 100

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3"
        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
        <div className="text-4xl">✏️</div>
        <div className="text-white text-xl font-black">Sowaka Scribble</div>
        <div className="text-purple-200 text-sm">Connecting to game...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen" style={{ background: '#f5f4ff' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #ec4899 100%)' }}
        className="shadow-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✏️</span>
            <div>
              <h1 className="text-xl font-black text-white leading-tight">Sowaka Scribble</h1>
              <p className="text-purple-200 text-xs">
                Game: <span className="font-black text-white tracking-widest">{code}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowLeaderboard(true)}
              className="flex items-center gap-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-2 rounded-xl font-bold text-sm transition">
              🏆 Leaderboard
            </button>
            <div className="bg-white bg-opacity-15 rounded-xl px-3 py-2 text-right">
              <p className="text-white font-bold text-sm leading-tight">{playerName}</p>
              <p className="text-purple-200 text-xs">{scores[playerName] || 0} pts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLeaderboard(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-gray-800">🏆 In-Game Scores</h2>
                <button onClick={() => setShowLeaderboard(false)}
                  className="text-gray-300 hover:text-gray-600 text-3xl font-light">&times;</button>
              </div>
              <LeaderboardWidget scores={scores} />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 md:p-6">

        {/* Lobby */}
        {gameState === 'lobby' && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #4f46e5, #ec4899)' }} />
            <div className="p-8">
              <h2 className="text-2xl font-black text-gray-800 mb-1">Waiting Room</h2>
              <p className="text-gray-400 text-sm mb-6">Share this code with your friends to join</p>

              <div className="rounded-2xl p-5 mb-7 text-center border-2 border-purple-100"
                style={{ background: 'linear-gradient(135deg, #f5f4ff, #fdf2ff)' }}>
                <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-1">Game Code</p>
                <p className="text-5xl font-black text-purple-600 tracking-[0.3em]">{code}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-7">
                {players.map((player, idx) => (
                  <div key={player.id}
                    className={`p-5 rounded-2xl border-2 text-center ${player.id === socketId ? 'border-purple-300 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black mx-auto mb-3 text-white"
                      style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                      {player.name[0].toUpperCase()}
                    </div>
                    <p className="font-bold text-gray-800 text-sm">{player.name}</p>
                    {player.id === hostId && (
                      <p className="text-xs text-purple-500 font-bold mt-1">👑 Host</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Game settings — editable by host, read-only for others */}
              <div className="bg-gray-50 rounded-2xl p-5 mb-5 border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                  ⚙️ Game Settings {!isHost && <span className="normal-case font-normal">(set by host)</span>}
                </p>
                <div className="flex flex-col sm:flex-row gap-5">
                  {/* Round duration */}
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-500 mb-2">⏱ Time per round</p>
                    <div className="flex gap-2 flex-wrap">
                      {DURATION_OPTIONS.map(opt => (
                        <button key={opt.value}
                          disabled={!isHost}
                          onClick={() => {
                            setRoundDuration(opt.value)
                            updateSettings(opt.value, undefined)
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold text-sm transition ${
                            roundDuration === opt.value
                              ? 'text-white shadow-md'
                              : 'bg-white text-gray-400 border border-gray-200 hover:border-purple-300 disabled:hover:border-gray-200'
                          } ${!isHost ? 'cursor-default' : ''}`}
                          style={roundDuration === opt.value
                            ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }
                            : {}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Difficulty */}
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-500 mb-2">📚 Word difficulty</p>
                    <div className="flex gap-2 flex-wrap">
                      {DIFFICULTY_OPTIONS.map(opt => (
                        <button key={opt.value}
                          disabled={!isHost}
                          onClick={() => {
                            setDifficulty(opt.value)
                            updateSettings(undefined, opt.value)
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold text-sm transition ${
                            difficulty === opt.value
                              ? 'text-white shadow-md'
                              : 'bg-white text-gray-400 border border-gray-200 hover:border-purple-300 disabled:hover:border-gray-200'
                          } ${!isHost ? 'cursor-default' : ''}`}
                          style={difficulty === opt.value
                            ? { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }
                            : {}}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Rounds */}
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-500 mb-2">🔄 Number of rounds</p>
                  <div className="flex gap-2 flex-wrap">
                    {ROUNDS_OPTIONS.map(opt => (
                      <button key={opt.value}
                        disabled={!isHost}
                        onClick={() => {
                          setTotalRounds(opt.value)
                          updateSettings(undefined, undefined, opt.value)
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-sm transition ${
                          totalRounds === opt.value
                            ? 'text-white shadow-md'
                            : 'bg-white text-gray-400 border border-gray-200 hover:border-purple-300 disabled:hover:border-gray-200'
                        } ${!isHost ? 'cursor-default' : ''}`}
                        style={totalRounds === opt.value
                          ? { background: 'linear-gradient(135deg, #10b981, #059669)' }
                          : {}}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {isHost ? (
                <button onClick={handleStartGame} disabled={players.length < 2}
                  className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all hover:opacity-90 active:scale-[0.99] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  {players.length < 2 ? 'Waiting for more players...' : '🚀 Start Game'}
                </button>
              ) : (
                <div className="text-center py-4 text-gray-400 font-medium">
                  Waiting for the host to start...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Playing */}
        {(gameState === 'playing' || gameState === 'roundend') && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left — canvas 3/5 */}
            <div className="lg:col-span-3 space-y-4">

              {/* Round counter */}
              <div className="flex justify-center">
                <div className="bg-white rounded-2xl px-5 py-2 shadow text-sm font-black text-purple-600 tracking-wide">
                  Round {currentRound} / {totalRounds}
                </div>
              </div>

              {/* Role banner */}
              {isDrawing ? (
                <div className="rounded-2xl p-4 text-center shadow-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                  <p className="text-xs font-black uppercase tracking-widest opacity-75 mb-1">
                    🖌️ Your word — draw it!
                  </p>
                  <p className="text-4xl font-black uppercase tracking-widest">{currentWord}</p>
                </div>
              ) : myGuessCorrect ? (
                <div className="rounded-2xl p-4 text-center shadow-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <p className="text-xs font-black uppercase tracking-widest opacity-75 mb-1">
                    🎉 You guessed it! Waiting for others...
                  </p>
                  <p className="text-3xl font-mono tracking-[0.6em] font-bold">{hint}</p>
                </div>
              ) : (
                <div className="rounded-2xl p-4 text-center shadow-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  <p className="text-xs font-black uppercase tracking-widest opacity-75 mb-1">
                    ✏️ {drawerName} is drawing — what is it?
                  </p>
                  <p className="text-3xl font-mono tracking-[0.6em] font-bold">{hint}</p>
                  <p className="text-xs opacity-60 mt-1">{wordLength} letters</p>
                </div>
              )}

              {/* Timer bar */}
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${timerPct}%`, backgroundColor: timerColor }} />
              </div>

              {/* Canvas */}
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    {isDrawing ? 'Your Canvas' : `${drawerName}'s Canvas`}
                  </p>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-black text-lg"
                    style={{ backgroundColor: timerBg, color: timerColor }}>
                    ⏱ {timeLeft}s
                  </div>
                </div>
                <div className="px-5 pb-4">
                  <GameCanvas
                    ref={canvasRef}
                    isActive={isDrawing}
                    onStroke={isDrawing ? handleStroke : undefined}
                  />
                </div>
                {isDrawing && (
                  <div className="px-5 pb-5">
                    <button onClick={handleClearCanvas}
                      className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold text-sm transition">
                      🗑️ Clear Canvas
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right — players + guess + feed 2/5 */}
            <div className="lg:col-span-2 space-y-4">

              {/* Players */}
              <div className="bg-white rounded-3xl shadow-xl p-5">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                  Players ({players.length})
                </p>
                <div className="space-y-2">
                  {players.map((player, idx) => (
                    <div key={player.id}
                      className="flex items-center justify-between p-3 rounded-2xl border"
                      style={player.id === drawerSocketId
                        ? { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }
                        : { borderColor: '#f3f4f6', backgroundColor: '#f9fafb' }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white"
                          style={{ backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                          {player.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm leading-tight">
                            {player.name}{player.id === socketId ? ' (you)' : ''}
                          </p>
                          {player.id === drawerSocketId && (
                            <p className="text-xs text-amber-500 font-bold">✏️ Drawing</p>
                          )}
                        </div>
                      </div>
                      <span className="font-black text-purple-600">{player.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guess input — guessers only, while round is live and not yet correct */}
              {!isDrawing && gameState === 'playing' && (
                <div className={`bg-white rounded-3xl shadow-xl overflow-hidden border-2 ${
                  myGuessCorrect ? 'border-green-200' : 'border-purple-200'
                }`}>
                  {myGuessCorrect ? (
                    <div className="px-5 py-5 text-center">
                      <p className="text-2xl mb-1">🎉</p>
                      <p className="font-black text-green-600 text-sm">You got it! Wait for others...</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-5 pt-4">
                        <p className="text-xs font-black uppercase tracking-widest mb-3"
                          style={{ color: '#7c3aed' }}>
                          💬 What are they drawing?
                        </p>
                        <input
                          ref={guessInputRef}
                          type="text"
                          value={guessInput}
                          onChange={e => setGuessInput(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleGuess()}
                          placeholder="Type your guess..."
                          autoFocus
                          className="w-full px-4 py-3 rounded-2xl border-2 focus:outline-none font-semibold text-gray-800 text-sm transition"
                          style={{ borderColor: '#e0d9ff', backgroundColor: '#faf9ff' }}
                          onFocus={e => { e.target.style.borderColor = '#7c3aed' }}
                          onBlur={e => { e.target.style.borderColor = '#e0d9ff' }}
                        />
                      </div>
                      <div className="px-5 pb-5 pt-3">
                        <button onClick={handleGuess} disabled={!guessInput.trim()}
                          className="w-full py-3 rounded-2xl font-black text-white text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 shadow-md"
                          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                          Submit Guess ↵
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Guesses feed */}
              <div className="bg-white rounded-3xl shadow-xl p-5">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                  Chat {guesses.length > 0 && (
                    <span className="text-purple-400">({guesses.length})</span>
                  )}
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {guesses.length === 0 ? (
                    <p className="text-gray-300 text-sm text-center py-6 font-medium">
                      No guesses yet...
                    </p>
                  ) : (
                    [...guesses].reverse().map((g, idx) => (
                      <div key={idx}
                        className={`flex items-start gap-2 p-3 rounded-2xl text-sm ${
                          g.correct
                            ? 'border-2 border-green-200 bg-green-50'
                            : 'bg-gray-50'
                        }`}>
                        <span className="text-base flex-shrink-0">
                          {g.correct ? '🎉' : '💭'}
                        </span>
                        <div className="min-w-0 break-words">
                          {g.correct ? (
                            <>
                              <span className="font-bold text-green-700">{g.player} </span>
                              <span className="text-green-600 font-semibold">guessed it!</span>
                              <span className="text-green-500 font-black ml-1 text-xs">+{g.points} pts</span>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-gray-700">{g.player}: </span>
                              <span className="text-gray-500">&quot;{g.guess}&quot;</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Round end modal */}
        {gameState === 'roundend' && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
            <div className="bg-white rounded-3xl shadow-2xl text-center p-10 max-w-sm w-full">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-black text-gray-800 mb-2">Round Over!</h2>
              <p className="text-purple-400 text-sm font-bold mb-3">Round {currentRound} of {totalRounds}</p>
              <p className="text-gray-400 text-sm mb-2">The word was:</p>
              <p className="text-4xl font-black uppercase mb-1 tracking-wide"
                style={{ color: '#7c3aed' }}>
                {roundWord}
              </p>
              <p className="text-gray-400 text-sm mb-8">
                {correctCount} player{correctCount !== 1 ? 's' : ''} guessed correctly
              </p>
              {isHost ? (
                <button onClick={handleNextRound}
                  className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  Next Round →
                </button>
              ) : (
                <p className="text-gray-400 font-medium">
                  Waiting for host to start next round...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Game over screen */}
        {gameState === 'gameover' && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-40 p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md my-auto overflow-hidden">
              {/* Header */}
              <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444, #7c3aed)' }} />
              <div className="px-8 pt-8 pb-4 text-center">
                <div className="text-5xl mb-3">🏆</div>
                <h2 className="text-3xl font-black text-gray-800 mb-1">Game Over!</h2>
                <p className="text-gray-400 text-sm">Final Leaderboard · {totalRounds} rounds played</p>
              </div>

              {/* Winner spotlight */}
              {(() => {
                const winner = [...players].sort((a, b) => b.score - a.score)[0]
                return winner ? (
                  <div className="mx-8 mb-5 rounded-2xl p-5 text-center"
                    style={{ background: 'linear-gradient(135deg, #fef9c3, #fef3c7)', border: '2px solid #fcd34d' }}>
                    <p className="text-xs font-black text-yellow-600 uppercase tracking-widest mb-1">Winner</p>
                    <p className="text-2xl font-black text-gray-800">{winner.name}</p>
                    <p className="text-yellow-600 font-black text-lg">{winner.score} pts</p>
                  </div>
                ) : null
              })()}

              {/* Full leaderboard */}
              <div className="px-8 pb-6 space-y-2">
                {[...players].sort((a, b) => b.score - a.score).map((p, idx) => (
                  <div key={p.id} className={`flex items-center justify-between px-4 py-3 rounded-2xl ${
                    idx === 0 ? 'bg-yellow-50 border-2 border-yellow-200' :
                    idx === 1 ? 'bg-gray-50 border-2 border-gray-200' :
                    idx === 2 ? 'bg-orange-50 border-2 border-orange-100' :
                    'bg-gray-50 border border-gray-100'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl w-8 text-center">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </span>
                      <span className="font-bold text-gray-800">
                        {p.name}{p.id === socketId ? ' (you)' : ''}
                      </span>
                    </div>
                    <span className="font-black text-purple-600">{p.score} pts</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="px-8 pb-8 flex gap-3">
                <button onClick={handleShareLeaderboard}
                  className="flex-1 py-3.5 rounded-2xl font-black text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  📤 Share Results
                </button>
                <button onClick={() => window.location.href = '/'}
                  className="flex-1 py-3.5 rounded-2xl font-black text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                  Play Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
        <div className="text-white text-xl font-bold">Loading...</div>
      </div>
    }>
      <GamePageInner />
    </Suspense>
  )
}
