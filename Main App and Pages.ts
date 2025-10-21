// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import AuthProvider from '../components/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ASM Equipment Schedule',
  description: 'Professional equipment scheduling and management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}

// app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">ASM Equipment Schedule</h1>
          <p className="text-muted-foreground mt-2">
            Professional equipment scheduling system
          </p>
          {role !== 'viewer' && (
            <p className="text-sm text-primary mt-2">
              You've been invited as an {role}
            </p>
          )}
        </div>
        
        <div className="bg-card p-6 rounded-lg border">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(221.2 83.2% 53.3%)',
                    brandAccent: 'hsl(221.2 83.2% 53.3%)',
                  },
                },
              },
            }}
            providers={[]}
            redirectTo={`${window.location.origin}/auth/callback?role=${role}`}
          />
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>New to ASM Equipment Schedule?</p>
          <p>Contact your administrator for an invitation.</p>
        </div>
      </div>
    </div>
  )
}

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
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      // Update user profile with the specified role if it's their first login
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile && role !== 'viewer') {
        await supabase
          .from('user_profiles')
          .update({ role })
          .eq('id', user.id)
      }
    }
  }

  return NextResponse.redirect(requestUrl.origin)
}

// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import ScheduleCalendar from '../components/ScheduleCalendar'
import UserManagement from '../components/UserManagement'
import { useAuth } from '../components/AuthProvider'
import { createClientClient } from '../lib/supabase'
import { Equipment, Location, ScheduleEntryWithDetails, Settings } from '../lib/types'
import { Plus, Users, MapPin, Wrench, LogOut, Calendar } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const { user, profile, loading: authLoading, signOut } = useAuth()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryWithDetails[]>([])
  const [settings, setSettings] = useState<Settings>({ start_hour: 6, end_hour: 18 })
  const [activeTab, setActiveTab] = useState<'schedule' | 'equipment' | 'locations' | 'users'>('schedule')
  const [loading, setLoading] = useState(false)
  const supabase = createClientClient()
  
  // Equipment form
  const [showEquipmentForm, setShowEquipmentForm] = useState(false)
  const [equipmentForm, setEquipmentForm] = useState({
    name: '', type: '', equipment_id: '', description: ''
  })
  
  // Location form
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [locationForm, setLocationForm] = useState({
    job_name: '', address: ''
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth')
    } else if (user && profile) {
      fetchData()
    }
  }, [user, profile, authLoading, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchEquipment(),
        fetchLocations(),
        fetchScheduleEntries(),
        fetchSettings()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEquipment = async () => {
    const { data } = await supabase
      .from('equipment')
      .select('*')
      .order('name')
    
    if (data) setEquipment(data)
  }

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('locations')
      .select('*')
      .order('job_name')
    
    if (data) setLocations(data)
  }

  const fetchScheduleEntries = async () => {
    const { data } = await supabase
      .from('schedule_entries')
      .select(`
        *,
        equipment:equipment_id(*),
        location:location_id(*)
      `)
      .order('day_of_week')
      .order('start_hour')
    
    if (data) {
      setScheduleEntries(data as ScheduleEntryWithDetails[])
    }
  }

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['start_hour', 'end_hour'])
    
    if (data) {
      const settingsMap = data.reduce((acc, item) => {
        acc[item.setting_key as keyof Settings] = parseInt(item.setting_value)
        return acc
      }, {} as Settings)
      
      setSettings({
        start_hour: settingsMap.start_hour || 6,
        end_hour: settingsMap.end_hour || 18
      })
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth')
  }

  const handleCreateEquipment = async () => {
    if (!equipmentForm.name || !equipmentForm.type || !equipmentForm.equipment_id) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('equipment')
        .insert({
          name: equipmentForm.name,
          type: equipmentForm.type,
          equipment_id: equipmentForm.equipment_id,
          description: equipmentForm.description || null
        })
      
      if (error) throw error
      
      setEquipmentForm({ name: '', type: '', equipment_id: '', description: '' })
      setShowEquipmentForm(false)
      await fetchEquipment()
    } catch (error) {
      console.error('Error creating equipment:', error)
      alert('Failed to create equipment. Make sure the Equipment ID is unique.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLocation = async () => {
    if (!locationForm.job_name || !locationForm.address) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('locations')
        .insert({
          job_name: locationForm.job_name,
          address: locationForm.address
        })
      
      if (error) throw error
      
      setLocationForm({ job_name: '', address: '' })
      setShowLocationForm(false)
      await fetchLocations()
    } catch (error) {
      console.error('Error creating location:', error)
      alert('Failed to create location')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  const canEdit = profile.role === 'admin' || profile.role === 'editor'
  const isAdmin = profile.role === 'admin'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">ASM Equipment Schedule</h1>
              <p className="text-sm text-muted-foreground">Professional Equipment Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium">{profile.full_name || user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'schedule' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="h-4 w-4 mr-2 inline" />
              Schedule
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => setActiveTab('equipment')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === 'equipment' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Wrench className="h-4 w-4 mr-2 inline" />
                  Equipment
                </button>
                <button
                  onClick={() => setActiveTab('locations')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === 'locations' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <MapPin className="h-4 w-4 mr-2 inline" />
                  Locations
                </button>
              </>
            )}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'users' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="h-4 w-4 mr-2 inline" />
                Users
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'schedule' && (
          <ScheduleCalendar
            equipment={equipment}
            locations={locations}
            scheduleEntries={scheduleEntries}
            settings={settings}
            onRefresh={fetchData}
          />
        )}

        {activeTab === 'equipment' && canEdit && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Equipment Management</h2>
              <Button onClick={() => setShowEquipmentForm(true)} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </div>

            {showEquipmentForm && (
              <div className="bg-card p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Add Equipment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Equipment Name *"
                    value={equipmentForm.name}
                    onChange={(e) => setEquipmentForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Equipment Type *"
                    value={equipmentForm.type}
                    onChange={(e) => setEquipmentForm(prev => ({ ...prev, type: e.target.value }))}
                  />
                  <Input
                    placeholder="Equipment ID * (must be unique)"
                    value={equipmentForm.equipment_id}
                    onChange={(e) => setEquipmentForm(prev => ({ ...prev, equipment_id: e.target.value }))}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={equipmentForm.description}
                    onChange={(e) => setEquipmentForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" onClick={() => setShowEquipmentForm(false)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateEquipment} disabled={loading}>
                    {loading ? 'Adding...' : 'Add Equipment'}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {equipment.map((eq) => (
                <div key={eq.id} className="bg-card p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{eq.name}</h3>
                      <p className="text-sm text-muted-foreground">ID: {eq.equipment_id}</p>
                      <p className="text-sm text-muted-foreground">Type: {eq.type}</p>
                      {eq.description && (
                        <p className="text-sm mt-2 text-foreground">{eq.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Added {new Date(eq.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {equipment.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No equipment found. Add your first piece of equipment to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'locations' && canEdit && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Location Management</h2>
              <Button onClick={() => setShowLocationForm(true)} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </div>

            {showLocationForm && (
              <div className="bg-card p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Add Location</h3>
                <div className="grid grid-cols-1 gap-4">
                  <Input
                    placeholder="Job Name *"
                    value={locationForm.job_name}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, job_name: e.target.value }))}
                  />
                  <Input
                    placeholder="Full Address *"
                    value={locationForm.address}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" onClick={() => setShowLocationForm(false)} disabled={loading}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateLocation} disabled={loading}>
                    {loading ? 'Adding...' : 'Add Location'}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {locations.map((loc) => (
                <div key={loc.id} className="bg-card p-4 rounded-lg border hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-lg">{loc.job_name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{loc.address}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Added {new Date(loc.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>

            {locations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No locations found. Add your first location to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManagement onRefresh={fetchData} />
        )}
      </main>
    </div>
  )
}

// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig

// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

// postcss.config.js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

// tsconfig.json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

// .env.local (example)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key