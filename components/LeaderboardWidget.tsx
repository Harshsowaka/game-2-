'use client'

export default function LeaderboardWidget({ scores }: { scores: Record<string, number> }) {
  const sortedScores = Object.entries(scores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-secondary">Leaderboard</h3>
      <div className="space-y-2">
        {sortedScores.length > 0 ? (
          sortedScores.map((player, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary w-6 text-center">#{idx + 1}</span>
                <span className="font-semibold text-gray-800">{player.name}</span>
              </div>
              <span className="text-lg font-bold text-primary">{player.score}</span>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 text-sm py-4">Scores will appear here</p>
        )}
      </div>
    </div>
  )
}
