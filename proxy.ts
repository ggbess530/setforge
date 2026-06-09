// ▸ Place at: middleware.ts  (project root, next to package.json)
// ▸ DELETE any other middleware or proxy file in your project root

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtectedRoute = createRouteMatcher([
  '/app(.*)',
  '/api/generate(.*)',
  '/api/swap(.*)',
  '/api/library(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Only run auth check on protected routes
  if (!isProtectedRoute(req)) return

  // Get the user ID from the session
  const { userId } = await auth()

  // Not signed in — redirect to Clerk's hosted sign-in page
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}