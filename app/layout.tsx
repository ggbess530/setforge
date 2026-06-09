// ▸ Replace: app/layout.tsx

import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

export const metadata: Metadata = {
  title:       'SetForge — AI DJ Set Creation',
  description: 'AI-powered DJ set curation. BPM matching, harmonic key sequencing, energy arc shaping.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body style={{ margin: 0, padding: 0, background: '#06060c' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}