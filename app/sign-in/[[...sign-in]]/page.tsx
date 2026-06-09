// ▸ Create folder: app/sign-in/[[...sign-in]]/
// ▸ Place at:      app/sign-in/[[...sign-in]]/page.tsx

import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#06060c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <SignIn />
    </div>
  )
}