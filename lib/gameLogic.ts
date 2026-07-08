export const WORDS = {
  easy: [
    'dog', 'cat', 'tree', 'house', 'car', 'sun', 'moon', 'star', 'fish', 'bird',
    'apple', 'banana', 'flower', 'cloud', 'rain', 'snow', 'fire', 'water', 'book', 'pen'
  ],
  medium: [
    'bicycle', 'rocket', 'pizza', 'basketball', 'piano', 'guitar', 'camera', 'telephone',
    'lighthouse', 'volcano', 'castle', 'bridge', 'airplane', 'train', 'ship', 'anchor',
    'elephant', 'dinosaur', 'giraffe', 'penguin'
  ],
  hard: [
    'procrastination', 'nostalgia', 'serendipity', 'ambition', 'resilience', 'perspective',
    'democracy', 'curiosity', 'innovation', 'conspiracy', 'metamorphosis', 'geometry',
    'symphony', 'chaos', 'harmony', 'paradox', 'symmetry', 'absurdity', 'fragile', 'momentum'
  ]
}

export const SCORING = {
  CORRECT_GUESS: 10,
  SPEED_BONUS: 5,
  SPEED_THRESHOLD: 10,
  DRAWER_PER_CORRECT: 5,
  ROUND_DURATION: 90,
}

export const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  TIMER_WARNING_THRESHOLD: 20,
}

export function getRandomWord(difficulty: keyof typeof WORDS = 'medium') {
  const words = WORDS[difficulty] || WORDS.medium
  return words[Math.floor(Math.random() * words.length)]
}

export function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function calculateScore(guessTime: number, roundDuration: number) {
  let score = SCORING.CORRECT_GUESS
  const timeThreshold = roundDuration - SCORING.SPEED_THRESHOLD
  if (guessTime <= timeThreshold) {
    score += SCORING.SPEED_BONUS
  }
  return score
}
