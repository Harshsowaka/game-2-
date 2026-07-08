# Sowaka Scribble

Multiplayer drawing game built for Sowaka employee engagement. Draw, guess, and compete!

## ✨ Features

- Real-time drawing canvas
- Multiplayer lobbies with game codes
- 90-second drawing rounds
- Scoring system (guess +10 pts, speed bonus +5 pts)
- Weekly leaderboard tracking
- Mobile + desktop responsive
- Guest mode (no login required)

## 🚀 Quick Start

### 1. Clone & Install
```bash
cd sowakascribble-local
npm install
```

### 2. Run Dev Server
```bash
npm run dev
```
Open http://localhost:3000

### 3. Test Game
- Open in two browsers (or phone + desktop)
- Player 1: Create game (get code)
- Player 2: Join with code
- Start playing!

## 📁 Project Structure

```
sowakascribble-local/
├── app/
│   ├── page.tsx           # Home/lobby page
│   ├── game/page.tsx      # Game page
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   └── api/
│       └── leaderboard/   # API endpoint
├── components/
│   ├── GameCanvas.tsx     # Drawing canvas
│   └── LeaderboardWidget  # Score display
├── lib/
│   └── gameLogic.ts       # Constants & utilities
├── package.json
├── tailwind.config.js
└── next.config.js
```

## 🎮 Game Rules

- **Duration:** 90 seconds per round
- **Scoring:**
  - Correct guess: +10 points
  - Speed bonus: +5 points (guess in first 10 sec)
  - Drawer: +5 points per correct guess
- **Leaderboard:** Weekly reset
- **Players:** 2-10 per game

## 🛠️ Customization

### Add More Words
Edit `lib/gameLogic.ts`:
```typescript
easy: ['your', 'words', 'here'],
```

### Change Scoring
Edit `lib/gameLogic.ts` → SCORING object

### Change Colors
Edit `tailwind.config.js` → colors theme

## 📦 Build & Deploy

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

## 🔮 Next Steps

- [ ] Add WebSocket for real-time drawing sync
- [ ] Connect to database (Supabase/Firebase)
- [ ] Add user authentication
- [ ] Deploy to Vercel

## 📝 Notes

- Current version uses mock data for demo
- Drawing sync ready for Socket.io integration
- Leaderboard stored in-memory (resets on restart)

---

Built for Sowaka | Employee Engagement & Wellness
