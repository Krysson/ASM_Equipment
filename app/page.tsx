// app/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'
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
  const [activeTab, setActiveTab] = useState<'schedule' | 'equipment' | 'locations' | 'users'>(
    'schedule'
  )
  const [loading, setLoading] = useState(false)
  const supabase = createClientClient()

  // Equipment form
  const [showEquipmentForm, setShowEquipmentForm] = useState(false)
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    type: '',
    equipment_id: '',
    description: ''
  })

  // Location form
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [locationForm, setLocationForm] = useState({
    job_name: '',
    address: ''
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
    const { data } = await supabase.from('equipment').select('*').order('name')

    if (data) setEquipment(data)
  }

  const fetchLocations = async () => {
    const { data } = await supabase.from('locations').select('*').order('job_name')

    if (data) setLocations(data)
  }

  const fetchScheduleEntries = async () => {
    const { data } = await supabase
      .from('schedule_entries')
      .select(
        `
        *,
        equipment:equipment_id(*),
        location:location_id(*)
      `
      )
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
      const { error } = await supabase.from('equipment').insert({
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
      const { error } = await supabase.from('locations').insert({
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
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto'></div>
          <p className='mt-2 text-muted-foreground'>Loading...</p>
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
    <div className='min-h-screen bg-background'>
      {/* Header */}
      <header className='border-b bg-card shadow-sm'>
        <div className='container mx-auto px-4 py-4 flex justify-between items-center'>
          <div className='flex items-center space-x-3'>
            <Calendar className='h-8 w-8 text-primary' />
            <div>
              <h1 className='text-2xl font-bold'>ASM Equipment Schedule</h1>
              <p className='text-sm text-muted-foreground'>Professional Equipment Management</p>
            </div>
          </div>
          <div className='flex items-center space-x-4'>
            <div className='text-right'>
              <p className='text-sm font-medium'>{profile.full_name || user.email}</p>
              <p className='text-xs text-muted-foreground capitalize'>{profile.role}</p>
            </div>
            <Button
              variant='outline'
              onClick={handleSignOut}>
              <LogOut className='h-4 w-4 mr-2' />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className='border-b bg-card'>
        <div className='container mx-auto px-4'>
          <div className='flex space-x-8'>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'schedule'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Calendar className='h-4 w-4 mr-2 inline' />
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
                  }`}>
                  <Wrench className='h-4 w-4 mr-2 inline' />
                  Equipment
                </button>
                <button
                  onClick={() => setActiveTab('locations')}
                  className={`py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === 'locations'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}>
                  <MapPin className='h-4 w-4 mr-2 inline' />
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
                }`}>
                <Users className='h-4 w-4 mr-2 inline' />
                Users
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className='container mx-auto px-4 py-8'>
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
          <div className='space-y-6'>
            <div className='flex justify-between items-center'>
              <h2 className='text-2xl font-bold'>Equipment Management</h2>
              <Button
                onClick={() => setShowEquipmentForm(true)}
                disabled={loading}>
                <Plus className='h-4 w-4 mr-2' />
                Add Equipment
              </Button>
            </div>

            {showEquipmentForm && (
              <div className='bg-card p-6 rounded-lg border'>
                <h3 className='text-lg font-semibold mb-4'>Add Equipment</h3>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <Input
                    placeholder='Equipment Name *'
                    value={equipmentForm.name}
                    onChange={e => setEquipmentForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder='Equipment Type *'
                    value={equipmentForm.type}
                    onChange={e => setEquipmentForm(prev => ({ ...prev, type: e.target.value }))}
                  />
                  <Input
                    placeholder='Equipment ID * (must be unique)'
                    value={equipmentForm.equipment_id}
                    onChange={e =>
                      setEquipmentForm(prev => ({ ...prev, equipment_id: e.target.value }))
                    }
                  />
                  <Input
                    placeholder='Description (optional)'
                    value={equipmentForm.description}
                    onChange={e =>
                      setEquipmentForm(prev => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>
                <div className='flex justify-end space-x-2 mt-4'>
                  <Button
                    variant='outline'
                    onClick={() => setShowEquipmentForm(false)}
                    disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateEquipment}
                    disabled={loading}>
                    {loading ? 'Adding...' : 'Add Equipment'}
                  </Button>
                </div>
              </div>
            )}

            <div className='grid gap-4'>
              {equipment.map(eq => (
                <div
                  key={eq.id}
                  className='bg-card p-4 rounded-lg border hover:shadow-md transition-shadow'>
                  <div className='flex justify-between items-start'>
                    <div>
                      <h3 className='font-semibold text-lg'>{eq.name}</h3>
                      <p className='text-sm text-muted-foreground'>ID: {eq.equipment_id}</p>
                      <p className='text-sm text-muted-foreground'>Type: {eq.type}</p>
                      {eq.description && (
                        <p className='text-sm mt-2 text-foreground'>{eq.description}</p>
                      )}
                      <p className='text-xs text-muted-foreground mt-2'>
                        Added {new Date(eq.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {equipment.length === 0 && (
              <div className='text-center py-8 text-muted-foreground'>
                No equipment found. Add your first piece of equipment to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'locations' && canEdit && (
          <div className='space-y-6'>
            <div className='flex justify-between items-center'>
              <h2 className='text-2xl font-bold'>Location Management</h2>
              <Button
                onClick={() => setShowLocationForm(true)}
                disabled={loading}>
                <Plus className='h-4 w-4 mr-2' />
                Add Location
              </Button>
            </div>

            {showLocationForm && (
              <div className='bg-card p-6 rounded-lg border'>
                <h3 className='text-lg font-semibold mb-4'>Add Location</h3>
                <div className='grid grid-cols-1 gap-4'>
                  <Input
                    placeholder='Job Name *'
                    value={locationForm.job_name}
                    onChange={e => setLocationForm(prev => ({ ...prev, job_name: e.target.value }))}
                  />
                  <Input
                    placeholder='Full Address *'
                    value={locationForm.address}
                    onChange={e => setLocationForm(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
                <div className='flex justify-end space-x-2 mt-4'>
                  <Button
                    variant='outline'
                    onClick={() => setShowLocationForm(false)}
                    disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateLocation}
                    disabled={loading}>
                    {loading ? 'Adding...' : 'Add Location'}
                  </Button>
                </div>
              </div>
            )}

            <div className='grid gap-4'>
              {locations.map(loc => (
                <div
                  key={loc.id}
                  className='bg-card p-4 rounded-lg border hover:shadow-md transition-shadow'>
                  <h3 className='font-semibold text-lg'>{loc.job_name}</h3>
                  <p className='text-sm text-muted-foreground mt-1'>{loc.address}</p>
                  <p className='text-xs text-muted-foreground mt-2'>
                    Added {new Date(loc.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>

            {locations.length === 0 && (
              <div className='text-center py-8 text-muted-foreground'>
                No locations found. Add your first location to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && isAdmin && <UserManagement onRefresh={fetchData} />}
      </main>
    </div>
  )
}
