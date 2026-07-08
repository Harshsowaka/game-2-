import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sowaka Scribble',
  description: 'Draw, Guess, Win - Multiplayer Drawing Game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
          {children}
        </div>
      </body>
    </html>
  )
}
