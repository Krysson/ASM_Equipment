// app/auth/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClientClient } from '../../lib/supabase'
import { useAuth } from '../../components/AuthProvider'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const supabase = createClientClient()
  const role = searchParams.get('role') || 'viewer'

  useEffect(() => {
    if (user) {
      router.push('/')
    }
  }, [user, router])

  if (user) {
    return <div>Redirecting...</div>
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-background'>
      <div className='w-full max-w-md space-y-6 p-6'>
        <div className='text-center'>
          <h1 className='text-3xl font-bold'>ASM Equipment Schedule</h1>
          <p className='text-muted-foreground mt-2'>Professional equipment scheduling system</p>
          {role !== 'viewer' && (
            <p className='text-sm text-primary mt-2'>You've been invited as an {role}</p>
          )}
        </div>

        <div className='bg-card p-6 rounded-lg border'>
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(221.2 83.2% 53.3%)',
                    brandAccent: 'hsl(221.2 83.2% 53.3%)'
                  }
                }
              }
            }}
            providers={[]}
            redirectTo={`${window.location.origin}/auth/callback?role=${role}`}
          />
        </div>

        <div className='text-center text-sm text-muted-foreground'>
          <p>New to ASM Equipment Schedule?</p>
          <p>Contact your administrator for an invitation.</p>
        </div>
      </div>
    </div>
  )
}
