'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { Booking } from '@/lib/types'
import BookingForm from '@/components/forms/BookingForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarRange, Check, X, Ban, LayoutList, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

export default function BookingsPage() {
  const { profile } = useApp()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const supabase = createClient()

  const fetchBookings = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, assets(name, asset_tag, current_department_id), profiles!bookings_requester_id_fkey(name)')
      .order('start_at', { ascending: false })
    setBookings((data || []) as unknown as Booking[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
    if (error) alert(error.message)
    else fetchBookings()
  }

  const handleApprove = async (bookingId: string, status: string) => {
    const { error } = await supabase.rpc('approve_booking', { 
      p_booking_id: bookingId, 
      p_status: status 
    })
    if (error) alert(error.message)
    else fetchBookings()
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const canApprove = (b: any) => {
    if (profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER') return true
    if (profile?.role === 'DEPARTMENT_HEAD') {
      if (profile.department_id) {
        const assetDept = b.assets?.current_department_id
        return profile.department_id === assetDept
      }
    }
    return false
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'UPCOMING': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'ONGOING': return 'bg-green-100 text-green-800 border-green-200'
      case 'COMPLETED': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200'
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const events = bookings.map(b => ({
    id: b.id,
    title: `${(b.assets as any)?.name} - ${(b.profiles as any)?.name}`,
    start: new Date(b.start_at),
    end: new Date(b.end_at),
    resource: b
  }))

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Resource Bookings</h2>
          <p className="text-muted-foreground mt-2">Manage shared resource reservations.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-muted p-1 rounded-lg border">
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="h-8">
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="h-8">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <CalendarRange className="mr-2 h-4 w-4" /> Book Resource
          </Button>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New Booking</DialogTitle>
          </DialogHeader>
          <BookingForm 
            onSuccess={() => { setShowForm(false); fetchBookings() }} 
            onCancel={() => setShowForm(false)} 
          />
        </DialogContent>
      </Dialog>

      {viewMode === 'calendar' ? (
        <Card>
          <CardContent className="p-6">
            <div style={{ height: 600 }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%', fontFamily: 'inherit' }}
                eventPropGetter={(event) => {
                  const status = event.resource.status
                  let bg = 'hsl(var(--primary))'
                  if (status === 'PENDING') bg = 'hsl(var(--warning))'
                  else if (status === 'ONGOING') bg = 'hsl(var(--success, 142.1 76.2% 36.3%))'
                  else if (status === 'CANCELLED' || status === 'REJECTED') bg = 'hsl(var(--destructive))'
                  return { style: { backgroundColor: bg, color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px' } }
                }}
                onSelectEvent={(event) => {
                  // A simple alert for now, could be a detailed modal
                  alert(`Booking for ${event.title}\nStatus: ${event.resource.status}\nStart: ${event.start.toLocaleString()}\nEnd: ${event.end.toLocaleString()}`)
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : bookings.map(b => {
                  const asset = b.assets as unknown as { name: string; asset_tag: string } | null
                  const requester = b.profiles as unknown as { name: string } | null
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium">{asset?.name}</div>
                        <div className="text-xs text-muted-foreground">{asset?.asset_tag}</div>
                      </TableCell>
                      <TableCell>{requester?.name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{new Date(b.start_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{new Date(b.end_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{b.purpose || '—'}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", getStatusBadge(b.status))}>
                          {b.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {b.status === 'PENDING' && canApprove(b) && (
                            <>
                              <Button size="sm" variant="default" onClick={() => handleApprove(b.id, 'UPCOMING')} title="Approve">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleApprove(b.id, 'REJECTED')} title="Reject">
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {b.status === 'PENDING' && !canApprove(b) && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancel(b.id)} title="Cancel">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {(b.status === 'UPCOMING' || b.status === 'ONGOING') && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancel(b.id)} title="Cancel">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
