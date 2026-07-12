'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { Allocation, Profile, Asset, Department } from '@/lib/types'

export default function AllocationsPage() {
  const { profile } = useApp()
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showReturn, setShowReturn] = useState<Allocation | null>(null)
  const [formData, setFormData] = useState({ asset_id: '', holder_id: '', expected_return_at: '' })
  const [transferData, setTransferData] = useState({ target_holder_id: '', reason: '' })
  const [bookedAssetIds, setBookedAssetIds] = useState<Set<string>>(new Set())
  const [returnData, setReturnData] = useState({ condition: 'Good', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const isManager = profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER'

  const fetchAllocations = useCallback(async () => {
    const { data, error } = await supabase
      .from('allocations')
      .select('*, assets(name, asset_tag, status)')
      .order('created_at', { ascending: false })
    if (error) console.error('Allocations error:', error)
    setAllocations((data || []) as unknown as Allocation[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAllocations()
    const fetchMeta = async () => {
      const [assetsRes, empRes, deptRes, bookingsRes] = await Promise.all([
        supabase.from('assets').select('id, name, asset_tag, status').not('status', 'in', '("RETIRED","DISPOSED","LOST")').order('name'),
        supabase.from('profiles').select('id, name, email').eq('status', 'ACTIVE').order('name'),
        supabase.from('departments').select('id, name').eq('status', 'ACTIVE').order('name'),
        supabase.from('bookings').select('asset_id').in('status', ['PENDING', 'UPCOMING', 'ONGOING'])
      ])
      
      const bookedIds = new Set((bookingsRes.data || []).map(b => b.asset_id))
      setBookedAssetIds(bookedIds)
      
      setAssets((assetsRes.data || []) as Asset[])
      setEmployees((empRes.data || []) as Profile[])
      setDepartments((deptRes.data || []) as Department[])
    }
    fetchMeta()
  }, [fetchAllocations, supabase])

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('allocate_asset', {
      p_asset_id: formData.asset_id,
      p_holder_type: 'EMPLOYEE',
      p_holder_id: formData.holder_id,
      p_expected_return_at: formData.expected_return_at ? new Date(formData.expected_return_at).toISOString() : null,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setShowForm(false)
      setFormData({ asset_id: '', holder_id: '', expected_return_at: '' })
      fetchAllocations()
    }
    setSaving(false)
  }

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showReturn) return
    setSaving(true)

    const { error: rpcError } = await supabase.rpc('return_asset', {
      p_asset_id: showReturn.asset_id,
      p_return_condition: returnData.condition,
      p_return_notes: returnData.notes || null,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setShowReturn(null)
      setReturnData({ condition: 'Good', notes: '' })
      fetchAllocations()
    }
    setSaving(false)
  }
  const getHolderName = (alloc: Allocation | null | undefined) => {
    if (!alloc) return 'Unknown'
    if (alloc.holder_type === 'EMPLOYEE') {
      const emp = employees.find(e => e.id === alloc.holder_id)
      return emp ? emp.name : 'Unknown Employee'
    } else if (alloc.holder_type === 'DEPARTMENT') {
      const dept = departments.find(d => d.id === alloc.holder_id)
      return dept ? `${dept.name} (Department)` : 'Unknown Department'
    }
    return 'Unknown'
  }
  
  const getHolderSubtitle = (alloc: Allocation) => {
    if (alloc.holder_type === 'EMPLOYEE') {
      const emp = employees.find(e => e.id === alloc.holder_id)
      return emp?.email || ''
    }
    return 'Department'
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAllocation) return
    setSaving(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('request_transfer', {
      p_asset_id: formData.asset_id,
      p_target_holder_type: 'EMPLOYEE',
      p_target_holder_id: transferData.target_holder_id,
      p_reason: transferData.reason || null,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setShowForm(false)
      setFormData({ asset_id: '', holder_id: '', expected_return_at: '' })
      setTransferData({ target_holder_id: '', reason: '' })
      alert('Transfer request submitted successfully!')
    }
    setSaving(false)
  }

  const selectedAsset = assets.find(a => a.id === formData.asset_id)
  const isBooked = formData.asset_id ? bookedAssetIds.has(formData.asset_id) : false
  const activeAllocation = formData.asset_id ? allocations.find(a => a.asset_id === formData.asset_id && a.status === 'ACTIVE') : undefined
  const isAllocated = !!activeAllocation
  const assetHistory = formData.asset_id ? allocations.filter(a => a.asset_id === formData.asset_id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []
  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      {isManager && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Allocate Asset</button>
        </div>
      )}

      {showForm && isManager && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Allocation & Transfer</h3>
          {error && <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠ {error}</div>}
          
          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="form-label">Asset *</label>
            <select className="form-select" value={formData.asset_id} onChange={e => {
                setFormData({...formData, asset_id: e.target.value})
                setTransferData({ target_holder_id: '', reason: '' })
                setError('')
            }} required>
              <option value="">Select asset</option>
              <optgroup label="Available">
                {assets.filter(a => a.status === 'AVAILABLE' && !bookedAssetIds.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
              </optgroup>
              <optgroup label="Allocated">
                {assets.filter(a => a.status === 'ALLOCATED').map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
              </optgroup>
              <optgroup label="Booked (Unavailable)">
                {assets.filter(a => bookedAssetIds.has(a.id)).map(a => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
              </optgroup>
            </select>
          </div>

          {selectedAsset && (
            <>
              {isBooked ? (
                 <div className="alert-banner alert-warning" style={{ marginBottom: 'var(--space-md)' }}>
                   ⚠ This asset is actively booked and cannot be permanently allocated at this time.
                 </div>
              ) : isAllocated ? (
                 <div style={{ marginBottom: 'var(--space-md)' }}>
                    <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>
                      <strong>Already Allocated to {getHolderName(activeAllocation)}</strong><br/>
                      Direct re-allocation is blocked - submit a transfer request below.
                    </div>
                    <form onSubmit={handleTransfer}>
                      <div className="flex gap-md" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                          <label className="form-label">From</label>
                          <input className="form-input" disabled value={getHolderName(activeAllocation)} />
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                          <label className="form-label">To (Select Employee) *</label>
                          <select className="form-select" value={transferData.target_holder_id} onChange={e => setTransferData({...transferData, target_holder_id: e.target.value})} required>
                            <option value="">Select employee...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                        <label className="form-label">Reason</label>
                        <textarea className="form-input" value={transferData.reason} onChange={e => setTransferData({...transferData, reason: e.target.value})} placeholder="Why is this transfer needed?" required />
                      </div>
                      <div className="flex gap-sm">
                         <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#2e7d32', borderColor: '#2e7d32' }} disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
                         <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                      </div>
                    </form>
                 </div>
              ) : (
                <form onSubmit={handleAllocate}>
                  <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                      <label className="form-label">Assign To *</label>
                      <select className="form-select" value={formData.holder_id} onChange={e => setFormData({...formData, holder_id: e.target.value})} required>
                        <option value="">Select employee</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                      <label className="form-label">Expected Return Date</label>
                      <input className="form-input" type="datetime-local" min={new Date().toISOString().slice(0,16)} value={formData.expected_return_at} onChange={e => setFormData({...formData, expected_return_at: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Allocating...' : 'Allocate'}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                  </div>
                </form>
              )}
              
              {assetHistory.length > 0 && (
                 <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                   <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>Allocation history</h4>
                   <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px' }}>
                     {assetHistory.map(hist => (
                       <li key={hist.id} style={{ marginBottom: '4px' }}>
                         <span className="text-muted">{new Date(hist.allocated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span> - 
                         {hist.status === 'ACTIVE' ? ` Allocated to ${getHolderName(hist)}` : ` Returned by ${getHolderName(hist)}`} 
                         {hist.status === 'RETURNED' && ` - condition: ${hist.return_condition || 'unknown'}`}
                       </li>
                     ))}
                   </ul>
                 </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Holder</th>
              <th>Allocated At</th>
              <th>Expected Return</th>
              <th>Status</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 ? (
              <tr><td colSpan={isManager ? 6 : 5} className="data-table-empty">No allocations yet</td></tr>
            ) : allocations.map(alloc => {
              const asset = alloc.assets as unknown as { name: string; asset_tag: string } | null
              
              let holderName = getHolderName(alloc)
              let holderSubtitle = getHolderSubtitle(alloc)

              const isOverdue = alloc.status === 'ACTIVE' && alloc.expected_return_at && new Date(alloc.expected_return_at) < new Date() && !alloc.returned_at
              
              return (
                <tr key={alloc.id}>
                  <td>
                    <div className="font-medium">{asset?.name}</div>
                    <div className="text-sm text-muted">{asset?.asset_tag}</div>
                  </td>
                  <td>
                    <div className="font-medium">{holderName}</div>
                    <div className="text-sm text-secondary">{holderSubtitle}</div>
                  </td>
                  <td className="text-sm">{new Date(alloc.allocated_at).toLocaleDateString()}</td>
                  <td>
                    {alloc.expected_return_at ? (
                      <span className={isOverdue ? 'badge badge-overdue' : 'text-sm'}>
                        {new Date(alloc.expected_return_at).toLocaleDateString()}
                        {isOverdue && ' (OVERDUE)'}
                      </span>
                    ) : <span className="text-muted text-sm">—</span>}
                  </td>
                  <td>
                    <span className={`badge badge-${alloc.status.toLowerCase()}`}>{alloc.status}</span>
                  </td>
                  {isManager && (
                    <td>
                      {alloc.status === 'ACTIVE' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowReturn(alloc); setReturnData({ condition: 'Good', notes: '' }) }}>
                          Return
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Return Modal */}
      {showReturn && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Return Asset</h3>
              <button className="modal-close" onClick={() => setShowReturn(null)}>✕</button>
            </div>
            <form onSubmit={handleReturn}>
              <div className="form-group">
                <label className="form-label">Return Condition</label>
                <select className="form-select" value={returnData.condition} onChange={e => setReturnData({...returnData, condition: e.target.value})}>
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Check-in Notes</label>
                <textarea className="form-input" value={returnData.notes} onChange={e => setReturnData({...returnData, notes: e.target.value})} placeholder="Optional notes about the return..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowReturn(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Processing...' : 'Confirm Return'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
