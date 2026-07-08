const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)

// ── Word lists by difficulty ─────────────────────────────────────────────────
const WORDS = {
  easy: [
    'dog', 'cat', 'sun', 'moon', 'tree', 'house', 'car', 'fish', 'bird', 'apple',
    'book', 'door', 'star', 'cake', 'boat', 'rain', 'shoe', 'hand', 'hat', 'ball',
    'bed', 'cup', 'egg', 'frog', 'king', 'lamp', 'nose', 'rose', 'ship', 'flag',
  ],
  medium: [
    'pizza', 'rocket', 'castle', 'guitar', 'bridge', 'anchor', 'camera', 'candle',
    'dragon', 'island', 'jungle', 'ladder', 'magnet', 'mirror', 'museum', 'orange',
    'parrot', 'pencil', 'pirate', 'planet', 'rabbit', 'safari', 'sailor', 'spider',
    'temple', 'trophy', 'tunnel', 'violin', 'walrus', 'zombie', 'cactus', 'compass',
    'dolphin', 'lantern', 'penguin', 'rainbow', 'snowman', 'tornado', 'unicorn',
    'volcano', 'balloon', 'bicycle', 'giraffe', 'glasses', 'hamster', 'igloo',
  ],
  hard: [
    'avalanche', 'binoculars', 'boomerang', 'chandelier', 'chameleon', 'clockwork',
    'earthquake', 'escalator', 'expedition', 'flamingo', 'greenhouse', 'guillotine',
    'hieroglyphs', 'hourglass', 'hurricane', 'kaleidoscope', 'lighthouse', 'microscope',
    'millennium', 'minotaur', 'observatory', 'parachute', 'porcupine', 'quicksand',
    'rhinoceros', 'scarecrow', 'shipwreck', 'skyscraper', 'stalactite', 'submarine',
    'sunflower', 'telescope', 'thunderstorm', 'toothbrush', 'trampoline', 'treehouse',
    'typewriter', 'waterfall', 'werewolf', 'whirlpool', 'wilderness', 'xylophone',
  ],
}

const DEFAULT_DURATION = 90
const rooms = {}

function randomWord(difficulty = 'medium') {
  const pool = WORDS[difficulty] || WORDS.medium
  return pool[Math.floor(Math.random() * pool.length)]
}

function playerList(room) {
  return room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
}

// Build the hint string: revealed letters shown, others as _
function buildHint(word, revealOrder, revealedCount) {
  const revealed = new Set(revealOrder.slice(0, revealedCount))
  return word.split('').map((c, i) => {
    if (c === ' ') return ' '
    return revealed.has(i) ? c : '_'
  }).join(' ')
}

function startRound(io, code) {
  const room = rooms[code]
  if (!room || room.players.length === 0) return

  if (room.timer) { clearInterval(room.timer); room.timer = null }

  room.gameState = 'playing'
  room.currentWord = randomWord(room.difficulty)
  room.correctGuessers = new Set()
  room.correctCount = 0
  room.drawerIndex = room.drawerIndex % room.players.length

  // Build shuffled hint reveal order (skip spaces)
  const positions = room.currentWord.split('').map((c, i) => i).filter(i => room.currentWord[i] !== ' ')
  room.hintOrder = positions.sort(() => Math.random() - 0.5)
  room.revealedCount = 0

  const duration = room.roundDuration
  const word = room.currentWord
  const drawer = room.players[room.drawerIndex]
  let timeLeft = duration

  // Clear canvas for everyone at round start
  io.to(code).emit('canvas-cleared')

  // Send round-started individually: drawer gets the word, guessers don't
  const initialHint = buildHint(word, room.hintOrder, 0)
  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.id)
    if (!s) continue
    s.emit('round-started', {
      players: playerList(room),
      drawerSocketId: drawer.id,
      word: p.id === drawer.id ? word : null,
      wordLength: word.length,
      hint: initialHint,
      timeLeft: duration,
      roundDuration: duration,
    })
  }

  const revealEvery = Math.max(1, Math.floor(duration / (positions.length + 1)))

  room.timer = setInterval(() => {
    timeLeft--
    io.to(code).emit('timer-tick', { timeLeft })

    // Progressive hint: reveal a letter every revealEvery seconds
    const elapsed = duration - timeLeft
    const shouldReveal = Math.floor(elapsed / revealEvery)
    const maxReveal = positions.length - 1 // always keep at least 1 hidden
    if (shouldReveal > room.revealedCount && room.revealedCount < maxReveal) {
      room.revealedCount = Math.min(shouldReveal, maxReveal)
      const hint = buildHint(word, room.hintOrder, room.revealedCount)
      // Send hint only to non-drawers
      for (const p of room.players) {
        if (p.id === drawer.id) continue
        const s = io.sockets.sockets.get(p.id)
        if (s) s.emit('hint-update', { hint })
      }
    }

    if (timeLeft <= 0) endRound(io, code)
  }, 1000)
}

function endRound(io, code) {
  const room = rooms[code]
  if (!room || room.gameState !== 'playing') return
  if (room.timer) { clearInterval(room.timer); room.timer = null }
  room.gameState = 'roundend'
  io.to(code).emit('round-ended', {
    word: room.currentWord,
    players: playerList(room),
  })
}

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true)
    if (parsedUrl.pathname?.startsWith('/socket.io')) return
    await handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, { cors: { origin: '*' } })

  io.on('connection', (socket) => {

    socket.on('join-room', ({ code, name }) => {
      if (!rooms[code]) {
        rooms[code] = {
          players: [],
          drawerIndex: 0,
          currentWord: '',
          gameState: 'lobby',
          timer: null,
          correctGuessers: new Set(),
          correctCount: 0,
          roundDuration: DEFAULT_DURATION,
          difficulty: 'medium',
          hintOrder: [],
          revealedCount: 0,
        }
      }
      const room = rooms[code]
      room.players = room.players.filter(p => p.id !== socket.id)
      room.players.push({ id: socket.id, name, score: 0 })
      socket.join(code)
      socket.data.code = code
      socket.data.name = name

      io.to(code).emit('room-update', {
        players: playerList(room),
        gameState: room.gameState,
        drawerIndex: room.drawerIndex,
        roundDuration: room.roundDuration,
        difficulty: room.difficulty,
      })
    })

    // Host updates settings in lobby
    socket.on('set-settings', ({ code, roundDuration, difficulty }) => {
      const room = rooms[code]
      if (!room || room.gameState !== 'lobby') return
      if (room.players[0]?.id !== socket.id) return
      if (roundDuration) room.roundDuration = roundDuration
      if (difficulty) room.difficulty = difficulty
      io.to(code).emit('room-update', {
        players: playerList(room),
        gameState: room.gameState,
        drawerIndex: room.drawerIndex,
        roundDuration: room.roundDuration,
        difficulty: room.difficulty,
      })
    })

    socket.on('start-game', ({ code }) => {
      const room = rooms[code]
      if (!room || room.gameState !== 'lobby') return
      if (room.players[0]?.id !== socket.id) return
      room.drawerIndex = 0
      startRound(io, code)
    })

    socket.on('next-round', ({ code }) => {
      const room = rooms[code]
      if (!room || room.gameState !== 'roundend') return
      if (room.players[0]?.id !== socket.id) return
      room.drawerIndex = (room.drawerIndex + 1) % room.players.length
      startRound(io, code)
    })

    socket.on('draw', ({ code, type, xn, yn }) => {
      const room = rooms[code]
      if (!room) return
      const drawer = room.players[room.drawerIndex]
      if (drawer?.id !== socket.id) return
      socket.to(code).emit('remote-draw', { type, xn, yn })
    })

    socket.on('clear-canvas', ({ code }) => {
      const room = rooms[code]
      if (!room) return
      const drawer = room.players[room.drawerIndex]
      if (drawer?.id !== socket.id) return
      socket.to(code).emit('remote-clear')
    })

    socket.on('make-guess', ({ code, guess }) => {
      const room = rooms[code]
      if (!room || room.gameState !== 'playing') return
      const player = room.players.find(p => p.id === socket.id)
      if (!player) return
      const drawer = room.players[room.drawerIndex]
      if (drawer?.id === socket.id) return
      if (room.correctGuessers.has(socket.id)) return

      const correct = guess.toLowerCase().trim() === room.currentWord.toLowerCase()

      if (correct) {
        room.correctGuessers.add(socket.id)
        room.correctCount++
        // Decreasing points: 1st = 10, 2nd = 9, 3rd = 8 … min 1
        const points = Math.max(1, 11 - room.correctCount)
        player.score += points
        if (drawer) drawer.score += 5

        // Private confirmation to the guesser only (includes pts earned)
        socket.emit('guess-correct', { points, players: playerList(room) })

        // Broadcast to everyone WITHOUT the guess text (so others can't copy)
        io.to(code).emit('guess-made', {
          playerName: player.name,
          guess: null,          // hidden
          correct: true,
          points,
          players: playerList(room),
        })
      } else {
        // Wrong guess — visible text is fine
        io.to(code).emit('guess-made', {
          playerName: player.name,
          guess,
          correct: false,
          points: 0,
          players: playerList(room),
        })
      }

      const nonDrawers = room.players.filter(p => p.id !== drawer?.id)
      if (nonDrawers.length > 0 && nonDrawers.every(p => room.correctGuessers.has(p.id))) {
        endRound(io, code)
      }
    })

    socket.on('disconnect', () => {
      const code = socket.data.code
      if (!code || !rooms[code]) return
      const room = rooms[code]
      room.players = room.players.filter(p => p.id !== socket.id)
      if (room.players.length === 0) {
        if (room.timer) clearInterval(room.timer)
        delete rooms[code]
      } else {
        if (room.drawerIndex >= room.players.length) room.drawerIndex = 0
        io.to(code).emit('room-update', {
          players: playerList(room),
          gameState: room.gameState,
          drawerIndex: room.drawerIndex,
          roundDuration: room.roundDuration,
          difficulty: room.difficulty,
        })
      }
    })
  })

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`\n✏️  Sowaka Scribble ready on http://localhost:${port}\n`)
  })
})
