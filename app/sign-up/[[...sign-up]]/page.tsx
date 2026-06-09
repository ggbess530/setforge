// ▸ Create folder: app/sign-up/[[...sign-up]]/
// ▸ Place at:      app/sign-up/[[...sign-up]]/page.tsx

import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#06060c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <SignUp />
    </div>
  )
}