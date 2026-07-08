// Two-player smoke test — simulates a full round end-to-end via sockets only.
// Run: node smoke-test.js   (server must already be up on :3000)

const { io } = require('socket.io-client')

const BASE = 'http://localhost:3000'
const CODE = 'SMOKETEST'
let passed = 0, failed = 0

function ok(label, cond) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else       { console.log(`  ❌  ${label}`); failed++ }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function waitFor(label, fn, timeout = 3000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (fn()) return true
    await sleep(50)
  }
  console.log(`  ⏱  timeout waiting for: ${label}`)
  return false
}

async function run() {
  console.log('\n🧪  Sowaka Scribble — Smoke Test\n')

  // ── 1. HTTP health ──────────────────────────────────────────────────────────
  console.log('── 1. HTTP ──')
  try {
    const r = await fetch(`${BASE}/api/leaderboard`)
    ok('GET /api/leaderboard → 200', r.ok)
    const data = await r.json()
    ok('Leaderboard returns array', Array.isArray(data))
  } catch {
    ok('HTTP server reachable', false)
  }

  // ── 2. Two clients connect ──────────────────────────────────────────────────
  console.log('\n── 2. Socket connection ──')
  const p1 = io(BASE, { reconnection: false })
  const p2 = io(BASE, { reconnection: false })

  let p1Connected = false, p2Connected = false
  p1.on('connect', () => { p1Connected = true })
  p2.on('connect', () => { p2Connected = true })

  await waitFor('both connected', () => p1Connected && p2Connected)
  ok('Player 1 connected', p1.connected)
  ok('Player 2 connected', p2.connected)

  // ── 3. Join room ────────────────────────────────────────────────────────────
  console.log('\n── 3. Join room ──')
  let roomUpdates = 0
  let lastPlayers = []
  p1.on('room-update', d => { roomUpdates++; lastPlayers = d.players })
  p2.on('room-update', d => { roomUpdates++; lastPlayers = d.players })

  p1.emit('join-room', { code: CODE, name: 'Drawer' })
  await sleep(200)
  p2.emit('join-room', { code: CODE, name: 'Guesser' })

  await waitFor('room has 2 players', () => lastPlayers.length === 2)
  ok('Both players appear in room', lastPlayers.length === 2)

  // ── 4. Start game ───────────────────────────────────────────────────────────
  console.log('\n── 4. Start game ──')
  let p1Round = null, p2Round = null
  p1.on('round-started', d => { p1Round = d })
  p2.on('round-started', d => { p2Round = d })

  p1.emit('start-game', { code: CODE })
  await waitFor('round started', () => p1Round && p2Round)

  ok('Drawer receives round-started', p1Round !== null)
  ok('Guesser receives round-started', p2Round !== null)
  ok('Drawer gets the secret word', typeof p1Round?.word === 'string' && p1Round.word.length > 0)
  ok('Guesser does NOT get the word', p2Round?.word === null)
  ok('Guesser gets word length', p2Round?.wordLength > 0)
  ok('Timer starts at 90s', p1Round?.timeLeft === 90)

  // ── 5. Timer ticks ──────────────────────────────────────────────────────────
  console.log('\n── 5. Timer ──')
  let ticksReceived = 0
  p2.on('timer-tick', () => ticksReceived++)
  await waitFor('at least 2 timer ticks', () => ticksReceived >= 2, 4000)
  ok('Timer ticks broadcast to clients', ticksReceived >= 2)

  // ── 6. Drawing sync ─────────────────────────────────────────────────────────
  console.log('\n── 6. Drawing sync ──')
  let remoteStrokes = 0, clearReceived = false
  p2.on('remote-draw', () => remoteStrokes++)
  p2.on('remote-clear', () => { clearReceived = true })

  p1.emit('draw', { code: CODE, type: 'start', xn: 0.3, yn: 0.3 })
  p1.emit('draw', { code: CODE, type: 'move',  xn: 0.5, yn: 0.5 })
  p1.emit('draw', { code: CODE, type: 'move',  xn: 0.7, yn: 0.4 })
  p1.emit('draw', { code: CODE, type: 'end',   xn: 0.7, yn: 0.4 })
  p1.emit('clear-canvas', { code: CODE })

  await waitFor('strokes received', () => remoteStrokes >= 3)
  ok(`Strokes synced to guesser (${remoteStrokes} received)`, remoteStrokes >= 3)
  await waitFor('clear received', () => clearReceived)
  ok('Canvas clear synced to guesser', clearReceived)

  // Non-drawer's draw events should be ignored
  let illegalDrawReceived = false
  p1.on('remote-draw', () => { illegalDrawReceived = true })
  p2.emit('draw', { code: CODE, type: 'start', xn: 0.1, yn: 0.1 })
  await sleep(200)
  ok('Guesser draw events ignored by server', !illegalDrawReceived)

  // ── 7. Wrong guess ──────────────────────────────────────────────────────────
  console.log('\n── 7. Guessing ──')
  let wrongGuess = null
  p1.on('guess-made', d => { if (!d.correct) wrongGuess = d })
  p2.on('guess-made', d => { if (!d.correct) wrongGuess = d })

  p2.emit('make-guess', { code: CODE, guess: 'zzzzwrongguess' })
  await waitFor('wrong guess broadcast', () => wrongGuess !== null)
  ok('Wrong guess broadcast to all', wrongGuess !== null)
  ok('Wrong guess marked incorrect', wrongGuess?.correct === false)

  // ── 8. Correct guess → round ends ───────────────────────────────────────────
  let correctGuess = null, roundEnded = null
  p1.on('guess-made', d => { if (d.correct) correctGuess = d })
  p2.on('guess-made', d => { if (d.correct) correctGuess = d })
  p1.on('round-ended', d => { roundEnded = d })
  p2.on('round-ended', d => { roundEnded = d })

  const word = p1Round.word
  p2.emit('make-guess', { code: CODE, guess: word })
  await waitFor('correct guess broadcast', () => correctGuess !== null)
  ok('Correct guess broadcast to all', correctGuess !== null)
  ok('Correct guess marked correct', correctGuess?.correct === true)
  ok('Scorer gets +10', correctGuess?.players?.find(p => p.name === 'Guesser')?.score === 10)
  ok('Drawer gets +5 per correct guess', correctGuess?.players?.find(p => p.name === 'Drawer')?.score === 5)

  await waitFor('round ends after all guessed', () => roundEnded !== null)
  ok('Round ends when all guessers correct', roundEnded !== null)
  ok('Word revealed in round-ended', roundEnded?.word === word)

  // ── 9. Next round + drawer rotation ─────────────────────────────────────────
  console.log('\n── 9. Next round ──')
  let nextRound1 = null, nextRound2 = null
  p1.once('round-started', d => { nextRound1 = d })
  p2.once('round-started', d => { nextRound2 = d })

  p1.emit('next-round', { code: CODE })
  await waitFor('next round started', () => nextRound1 && nextRound2)
  ok('Next round fires for both players', nextRound1 && nextRound2)
  ok('Drawer rotates (p2 is now drawer)', nextRound2?.word !== null)
  ok('P1 does not see new word (now guesser)', nextRound1?.word === null)

  // ── 10. Disconnect cleanup ───────────────────────────────────────────────────
  console.log('\n── 10. Disconnect ──')
  let updateAfterDisconnect = null
  p1.on('room-update', d => { updateAfterDisconnect = d })

  p2.disconnect()
  await waitFor('room-update after disconnect', () => updateAfterDisconnect !== null)
  ok('Room updates when player leaves', updateAfterDisconnect !== null)
  ok('Leaver removed from player list',
    !updateAfterDisconnect?.players?.find(p => p.name === 'Guesser'))

  p1.disconnect()
  await sleep(200)

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = passed + failed
  console.log(`\n${'─'.repeat(44)}`)
  console.log(`  ${passed}/${total} passed  |  ${failed} failed`)
  if (failed === 0) {
    console.log('\n  🎉  All checks passed — ready to test with colleagues!\n')
  } else {
    console.log('\n  ⚠️   Some checks failed — see above for details.\n')
  }
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('\nFatal test error:', err.message)
  process.exit(1)
})
