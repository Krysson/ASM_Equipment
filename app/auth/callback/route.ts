// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const role = requestUrl.searchParams.get('role') || 'viewer'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error
    } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Update user profile with the specified role if it's their first login
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile && role !== 'viewer') {
        await supabase.from('user_profiles').update({ role }).eq('id', user.id)
      }
    }
  }

  return NextResponse.redirect(requestUrl.origin)
}
