'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { Booking, Asset } from '@/lib/types'

export default function BookingsPage() {
  const { profile } = useApp()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ asset_id: '', start_at: '', end_at: '', purpose: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
    const fetchAssets = async () => {
      const { data } = await supabase.from('assets').select('id, name, asset_tag').eq('is_bookable', true).not('status', 'in', '("RETIRED","DISPOSED")').order('name')
      setBookableAssets((data || []) as Asset[])
    }
    fetchAssets()
  }, [fetchBookings, supabase])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('create_booking', {
      p_asset_id: formData.asset_id,
      p_start_at: new Date(formData.start_at).toISOString(),
      p_end_at: new Date(formData.end_at).toISOString(),
      p_purpose: formData.purpose || null,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setShowForm(false)
      setFormData({ asset_id: '', start_at: '', end_at: '', purpose: '' })
      fetchBookings()
    }
    setSaving(false)
  }

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

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value
    setFormData(prev => {
      // If end_at is earlier than new start_at, auto-update it
      const newEnd = (prev.end_at && prev.end_at < newStart) ? newStart : prev.end_at
      return { ...prev, start_at: newStart, end_at: newEnd }
    })
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  const canApprove = (b: any) => {
    if (profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER') return true
    if (profile?.role === 'DEPARTMENT_HEAD') {
      const assetDept = b.assets?.current_department_id
      return profile.department_id === assetDept
    }
    return false
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>📅 Book Resource</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>New Booking</h3>
          {error && <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠ {error}</div>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Resource *</label>
                <select className="form-select" value={formData.asset_id} onChange={e => setFormData({...formData, asset_id: e.target.value})} required>
                  <option value="">Select resource</option>
                  {bookableAssets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start *</label>
                <input className="form-input" type="datetime-local" min={new Date().toISOString().slice(0,16)} value={formData.start_at} onChange={handleStartDateChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">End *</label>
                <input className="form-input" type="datetime-local" min={formData.start_at || new Date().toISOString().slice(0,16)} value={formData.end_at} onChange={e => setFormData({...formData, end_at: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">Purpose</label>
                <input className="form-input" value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} placeholder="e.g. Team standup" />
              </div>
            </div>
            <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Booking...' : 'Create Booking'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Requester</th>
              <th>Start</th>
              <th>End</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr><td colSpan={7} className="data-table-empty">No bookings yet</td></tr>
            ) : bookings.map(b => {
              const asset = b.assets as unknown as { name: string; asset_tag: string } | null
              const requester = b.profiles as unknown as { name: string } | null
              return (
                <tr key={b.id}>
                  <td>
                    <div className="font-medium">{asset?.name}</div>
                    <div className="text-sm text-muted">{asset?.asset_tag}</div>
                  </td>
                  <td className="text-sm">{requester?.name}</td>
                  <td className="text-sm">{new Date(b.start_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="text-sm">{new Date(b.end_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="text-sm text-secondary truncate" style={{ maxWidth: '200px' }}>{b.purpose || '—'}</td>
                  <td><span className={`badge badge-${b.status.toLowerCase()}`}>{b.status}</span></td>
                  <td>
                    {b.status === 'PENDING' && canApprove(b) && (
                      <div className="flex gap-sm">
                        <button className="btn btn-primary btn-sm" onClick={() => handleApprove(b.id, 'UPCOMING')}>Approve</button>
                        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleApprove(b.id, 'REJECTED')}>Reject</button>
                      </div>
                    )}
                    {b.status === 'PENDING' && !canApprove(b) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(b.id)}>Cancel</button>
                    )}
                    {(b.status === 'UPCOMING' || b.status === 'ONGOING') && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(b.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
