// components/AuthProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClientClient } from '../lib/supabase'
import { User } from '@supabase/supabase-js'
import { UserProfile } from '../lib/types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {}
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientClient()

  const fetchProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    setProfile(profile)
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        await fetchProfile(user.id)
      }
      
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// components/ScheduleCalendar.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Equipment, Location, Settings, ScheduleEntryWithDetails } from '../lib/types'
import { Plus, Trash2, Settings as SettingsIcon } from 'lucide-react'
import { createClientClient } from '../lib/supabase'
import { useAuth } from './AuthProvider'

interface ScheduleCalendarProps {
  equipment: Equipment[]
  locations: Location[]
  scheduleEntries: ScheduleEntryWithDetails[]
  settings: Settings
  onRefresh: () => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ScheduleCalendar({
  equipment,
  locations,
  scheduleEntries,
  settings,
  onRefresh
}: ScheduleCalendarProps) {
  const { profile } = useAuth()
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClientClient()

  const [newEntry, setNewEntry] = useState({
    equipmentId: '',
    locationId: '',
    dayOfWeek: '',
    startHour: '',
    endHour: '',
    notes: ''
  })

  const [settingsForm, setSettingsForm] = useState({
    startHour: settings.start_hour.toString(),
    endHour: settings.end_hour.toString()
  })

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const displayHours = hours.filter(hour => hour >= settings.start_hour && hour <= settings.end_hour)

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:00 ${period}`
  }

  const getScheduleForEquipment = (equipmentId: string) => {
    return scheduleEntries.filter(entry => entry.equipment_id === equipmentId)
  }

  const getEntryForCell = (equipmentId: string, dayOfWeek: number, hour: number) => {
    const equipmentSchedule = getScheduleForEquipment(equipmentId)
    return equipmentSchedule.find(entry => 
      entry.day_of_week === dayOfWeek && 
      hour >= entry.start_hour && 
      hour < entry.end_hour
    )
  }

  const handleAddEntry = async () => {
    if (!newEntry.equipmentId || !newEntry.locationId || newEntry.dayOfWeek === '' || 
        newEntry.startHour === '' || newEntry.endHour === '') {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('schedule_entries')
        .insert({
          equipment_id: newEntry.equipmentId,
          location_id: newEntry.locationId,
          day_of_week: parseInt(newEntry.dayOfWeek),
          start_hour: parseInt(newEntry.startHour),
          end_hour: parseInt(newEntry.endHour),
          notes: newEntry.notes || null
        })

      if (error) throw error

      setNewEntry({
        equipmentId: '',
        locationId: '',
        dayOfWeek: '',
        startHour: '',
        endHour: '',
        notes: ''
      })
      setShowAddForm(false)
      onRefresh()
    } catch (error) {
      console.error('Error adding schedule entry:', error)
      alert('Failed to add schedule entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule entry?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('id', id)

      if (error) throw error
      onRefresh()
    } catch (error) {
      console.error('Error deleting schedule entry:', error)
      alert('Failed to delete schedule entry')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSettings = async () => {
    const startHour = parseInt(settingsForm.startHour)
    const endHour = parseInt(settingsForm.endHour)
    
    if (startHour >= 0 && endHour <= 23 && startHour < endHour) {
      setLoading(true)
      try {
        await Promise.all([
          supabase
            .from('settings')
            .update({ setting_value: startHour.toString() })
            .eq('setting_key', 'start_hour'),
          supabase
            .from('settings')
            .update({ setting_value: endHour.toString() })
            .eq('setting_key', 'end_hour')
        ])

        setShowSettings(false)
        onRefresh()
      } catch (error) {
        console.error('Error updating settings:', error)
        alert('Failed to update settings')
      } finally {
        setLoading(false)
      }
    }
  }

  const canEdit = profile?.role === 'admin' || profile?.role === 'editor'
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold">Equipment Schedule</h2>
          <Select value={selectedEquipment || 'all'} onValueChange={(value) => 
            setSelectedEquipment(value === 'all' ? null : value)
          }>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filter by equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {equipment.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.name} ({eq.equipment_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex space-x-2">
          {canEdit && (
            <>
              <Button onClick={() => setShowAddForm(true)} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
              {isAdmin && (
                <Button variant="outline" onClick={() => setShowSettings(true)} disabled={loading}>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Entry Form */}
      {showAddForm && canEdit && (
        <div className="bg-card p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Add Schedule Entry</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Select value={newEntry.equipmentId} onValueChange={(value) => 
              setNewEntry(prev => ({ ...prev, equipmentId: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.name} ({eq.equipment_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newEntry.locationId} onValueChange={(value) => 
              setNewEntry(prev => ({ ...prev, locationId: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.job_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newEntry.dayOfWeek} onValueChange={(value) => 
              setNewEntry(prev => ({ ...prev, dayOfWeek: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day, index) => (
                  <SelectItem key={index} value={index.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newEntry.startHour} onValueChange={(value) => 
              setNewEntry(prev => ({ ...prev, startHour: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Start hour" />
              </SelectTrigger>
              <SelectContent>
                {displayHours.map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newEntry.endHour} onValueChange={(value) => 
              setNewEntry(prev => ({ ...prev, endHour: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="End hour" />
              </SelectTrigger>
              <SelectContent>
                {displayHours.map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Notes (optional)"
              value={newEntry.notes}
              onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowAddForm(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleAddEntry} disabled={loading}>
              {loading ? 'Adding...' : 'Add Entry'}
            </Button>
          </div>
        </div>
      )}

      {/* Settings Form */}
      {showSettings && isAdmin && (
        <div className="bg-card p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Schedule Settings</h3>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium mb-2">Start Hour</label>
              <Select value={settingsForm.startHour} onValueChange={(value) => 
                setSettingsForm(prev => ({ ...prev, startHour: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.slice(0, 22).map((hour) => (
                    <SelectItem key={hour} value={hour.toString()}>
                      {formatHour(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Hour</label>
              <Select value={settingsForm.endHour} onValueChange={(value) => 
                setSettingsForm(prev => ({ ...prev, endHour: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hours.slice(2, 24).map((hour) => (
                    <SelectItem key={hour} value={hour.toString()}>
                      {formatHour(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowSettings(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSettings} disabled={loading}>
              {loading ? 'Updating...' : 'Update Settings'}
            </Button>
          </div>
        </div>
      )}

      {/* Schedule Grid */}
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-4 font-semibold min-w-[200px]">Equipment</th>
                {DAYS.map((day) => (
                  <th key={day} className="text-center p-4 font-semibold min-w-[120px]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipment
                .filter(eq => !selectedEquipment || eq.id === selectedEquipment)
                .map((eq) => (
                <tr key={eq.id} className="border-t">
                  <td className="p-4 bg-muted/50">
                    <div>
                      <div className="font-semibold">{eq.name}</div>
                      <div className="text-sm text-muted-foreground">{eq.equipment_id}</div>
                      <div className="text-xs text-muted-foreground">{eq.type}</div>
                    </div>
                  </td>
                  {DAYS.map((day, dayIndex) => (
                    <td key={`${eq.id}-${dayIndex}`} className="p-2 align-top">
                      <div className="space-y-1">
                        {displayHours.map((hour) => {
                          const entry = getEntryForCell(eq.id, dayIndex, hour)
                          if (!entry || hour !== entry.start_hour) return null
                          
                          const duration = entry.end_hour - entry.start_hour
                          return (
                            <div
                              key={`${entry.id}-${hour}`}
                              className="bg-primary/10 border border-primary/20 rounded p-2 text-xs relative group"
                              style={{ minHeight: `${duration * 20}px` }}
                            >
                              <div className="font-medium">{entry.location.job_name}</div>
                              <div className="text-muted-foreground">
                                {formatHour(entry.start_hour)} - {formatHour(entry.end_hour)}
                              </div>
                              {entry.notes && (
                                <div className="text-muted-foreground mt-1">{entry.notes}</div>
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80"
                                  disabled={loading}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {equipment.filter(eq => !selectedEquipment || eq.id === selectedEquipment).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No equipment found. {canEdit && 'Add some equipment to get started.'}
        </div>
      )}
    </div>
  )
}

// components/UserManagement.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { createClientClient } from '../lib/supabase'
import { UserProfile } from '../lib/types'
import { useAuth } from './AuthProvider'
import { Plus, Crown, Edit, Eye } from 'lucide-react'

interface UserManagementProps {
  onRefresh: () => void
}

export default function UserManagement({ onRefresh }: UserManagementProps) {
  const { profile: currentUserProfile } = useAuth()
  const [users, setUsers] = useState<(UserProfile & { email: string })[]>([])
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClientClient()

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'viewer' as 'admin' | 'editor' | 'viewer'
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select(`
          *,
          auth_users:auth.users!inner(email)
        `)
        .order('created_at', { ascending: false })

      if (profiles) {
        const usersWithEmail = profiles.map(profile => ({
          ...profile,
          email: (profile as any).auth_users.email
        }))
        setUsers(usersWithEmail)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleInviteUser = async () => {
    if (!inviteForm.email) return

    setLoading(true)
    try {
      // Create invitation link (admin would send this manually)
      alert(`Send this signup link to ${inviteForm.email}:\n\n${window.location.origin}/auth?role=${inviteForm.role}\n\nThey will be assigned the ${inviteForm.role} role after signup.`)
      
      setInviteForm({ email: '', role: 'viewer' })
      setShowInviteForm(false)
    } catch (error) {
      console.error('Error inviting user:', error)
      alert('Failed to create invitation')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      
      await fetchUsers()
      onRefresh()
    } catch (error) {
      console.error('Error updating user role:', error)
      alert('Failed to update user role')
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4 text-red-500" />
      case 'editor': return <Edit className="h-4 w-4 text-blue-500" />
      case 'viewer': return <Eye className="h-4 w-4 text-green-500" />
      default: return null
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'editor': return 'bg-blue-100 text-blue-800'
      case 'viewer': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isAdmin = currentUserProfile?.role === 'admin'

  if (!isAdmin) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        You don't have permission to view user management.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={() => setShowInviteForm(true)} disabled={loading}>
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-card p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Invite New User</h3>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <Input
              placeholder="Email address"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
            />
            <Select value={inviteForm.role} onValueChange={(value: 'admin' | 'editor' | 'viewer') => 
              setInviteForm(prev => ({ ...prev, role: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowInviteForm(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={loading}>
              {loading ? 'Creating...' : 'Create Invitation'}
            </Button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="grid gap-4">
        {users.map((user) => (
          <div key={user.id} className="bg-card p-4 rounded-lg border">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold">{user.full_name || 'Unnamed User'}</h3>
                  {getRoleIcon(user.role)}
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-2 ${getRoleColor(user.role)}`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
              
              {user.id !== currentUserProfile?.id && (
                <div className="flex flex-col space-y-2">
                  <Select 
                    value={user.role} 
                    onValueChange={(value: 'admin' | 'editor' | 'viewer') => 
                      handleUpdateUserRole(user.id, value)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No users found. Start by inviting team members.
        </div>
      )}
    </div>
  )
}