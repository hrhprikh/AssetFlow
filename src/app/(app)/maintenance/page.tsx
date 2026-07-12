'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { MaintenanceRequest, Asset } from '@/lib/types'

export default function MaintenancePage() {
  const { profile } = useApp()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ asset_id: '', issue: '', priority: 'MEDIUM' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const isManager = profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER'

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('maintenance_requests')
      .select('*, assets(name, asset_tag), profiles!maintenance_requests_raised_by_fkey(name)')
      .order('created_at', { ascending: false })
    setRequests((data || []) as unknown as MaintenanceRequest[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchRequests()
    const fetchAssets = async () => {
      const { data } = await supabase.from('assets').select('id, name, asset_tag').not('status', 'in', '("DISPOSED")').order('name')
      setAssets((data || []) as Asset[])
    }
    fetchAssets()
  }, [fetchRequests, supabase])

  const handleRaise = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('raise_maintenance', {
      p_asset_id: formData.asset_id,
      p_issue: formData.issue,
      p_priority: formData.priority,
    })

    if (rpcError) setError(rpcError.message)
    else { setShowForm(false); setFormData({ asset_id: '', issue: '', priority: 'MEDIUM' }); fetchRequests() }
    setSaving(false)
  }

  const handleApprove = async (id: string) => {
    const { error } = await supabase.rpc('approve_maintenance', { p_request_id: id })
    if (error) alert(error.message)
    else fetchRequests()
  }

  const handleReject = async (id: string) => {
    const { error } = await supabase.rpc('reject_maintenance', { p_request_id: id })
    if (error) alert(error.message)
    else fetchRequests()
  }

  const handleResolve = async (id: string) => {
    const notes = prompt('Resolution notes (optional):')
    const { error } = await supabase.rpc('resolve_maintenance', { p_request_id: id, p_resolution_notes: notes || null })
    if (error) alert(error.message)
    else fetchRequests()
  }

  const getPriorityBadge = (p: string) => {
    const map: Record<string, string> = { LOW: 'badge-active', MEDIUM: 'badge-reserved', HIGH: 'badge-allocated', CRITICAL: 'badge-danger' }
    return map[p] || 'badge-active'
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>🔧 Raise Maintenance Request</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>New Maintenance Request</h3>
          {error && <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠ {error}</div>}
          <form onSubmit={handleRaise}>
            <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label">Asset *</label>
                <select className="form-select" value={formData.asset_id} onChange={e => setFormData({...formData, asset_id: e.target.value})} required>
                  <option value="">Select asset</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                <label className="form-label">Priority *</label>
                <select className="form-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Issue Description *</label>
              <textarea className="form-input" value={formData.issue} onChange={e => setFormData({...formData, issue: e.target.value})} required placeholder="Describe the issue..." />
            </div>
            <div className="flex gap-sm">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Raised By</th>
              <th>Issue</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Date</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={isManager ? 7 : 6} className="data-table-empty">No maintenance requests</td></tr>
            ) : requests.map(req => {
              const asset = req.assets as unknown as { name: string; asset_tag: string } | null
              const raiser = req.profiles as unknown as { name: string } | null
              return (
                <tr key={req.id}>
                  <td>
                    <div className="font-medium">{asset?.name}</div>
                    <div className="text-sm text-muted">{asset?.asset_tag}</div>
                  </td>
                  <td className="text-sm">{raiser?.name}</td>
                  <td className="text-sm truncate" style={{ maxWidth: '250px' }}>{req.issue}</td>
                  <td><span className={`badge ${getPriorityBadge(req.priority)}`}>{req.priority}</span></td>
                  <td><span className={`badge badge-${req.status.toLowerCase().replace('_', '-')}`}>{req.status.replace('_', ' ')}</span></td>
                  <td className="text-sm text-muted">{new Date(req.created_at).toLocaleDateString()}</td>
                  {isManager && (
                    <td>
                      <div className="flex gap-xs">
                        {req.status === 'PENDING' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req.id)}>Approve</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleReject(req.id)}>Reject</button>
                          </>
                        )}
                        {['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(req.status) && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleResolve(req.id)}>Resolve</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
