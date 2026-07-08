let leaderboardData = [
  { name: 'Alex', score: 850 },
  { name: 'Jordan', score: 720 },
  { name: 'Casey', score: 650 },
  { name: 'Morgan', score: 580 },
  { name: 'Taylor', score: 520 },
  { name: 'Riley', score: 450 },
  { name: 'Avery', score: 380 },
  { name: 'Quinn', score: 290 },
  { name: 'Drew', score: 180 },
  { name: 'Sam', score: 100 },
]

export async function GET() {
  return Response.json(leaderboardData)
}

export async function POST(req) {
  const { playerName, score } = await req.json()

  const existing = leaderboardData.find((p) => p.name === playerName)
  if (existing) {
    existing.score += score
  } else {
    leaderboardData.push({ name: playerName, score })
  }

  leaderboardData.sort((a, b) => b.score - a.score)
  leaderboardData = leaderboardData.slice(0, 100)

  return Response.json({ success: true, leaderboard: leaderboardData })
}
