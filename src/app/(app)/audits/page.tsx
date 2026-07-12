'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { AuditCycle, AuditItem, Profile, Department } from '@/lib/types'

export default function AuditsPage() {
  const { profile } = useApp()
  const [cycles, setCycles] = useState<AuditCycle[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [auditors, setAuditors] = useState<Profile[]>([])
  const [selectedCycle, setSelectedCycle] = useState<AuditCycle | null>(null)
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [cycleAuditors, setCycleAuditors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', scope_type: 'DEPARTMENT', scope_id: '', start_date: '', end_date: '', auditor_ids: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const isAdmin = profile?.role === 'ADMIN'

  const fetchCycles = useCallback(async () => {
    const { data } = await supabase.from('audit_cycles').select('*').order('created_at', { ascending: false })
    setCycles((data || []) as AuditCycle[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchCycles()
    const fetchMeta = async () => {
      const [deptRes, profileRes] = await Promise.all([
        supabase.from('departments').select('*').eq('status', 'ACTIVE').order('name'),
        supabase.from('profiles').select('id, name, email, role').eq('status', 'ACTIVE').order('name'),
      ])
      setDepartments((deptRes.data || []) as Department[])
      setAuditors((profileRes.data || []) as Profile[])
    }
    fetchMeta()
  }, [fetchCycles, supabase])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: cycle, error: insertError } = await supabase.from('audit_cycles').insert({
      name: formData.name, scope_type: formData.scope_type, scope_id: formData.scope_id || null,
      start_date: formData.start_date, end_date: formData.end_date, created_by: profile?.id,
    }).select().single()

    if (insertError) { setError(insertError.message); setSaving(false); return }

    // Assign auditors
    if (formData.auditor_ids.length > 0) {
      await supabase.from('audit_assignments').insert(
        formData.auditor_ids.map(aid => ({ audit_cycle_id: cycle.id, auditor_id: aid }))
      )
    }

    setShowForm(false)
    setFormData({ name: '', scope_type: 'DEPARTMENT', scope_id: '', start_date: '', end_date: '', auditor_ids: [] })
    fetchCycles()
    setSaving(false)
  }

  const handleOpen = async (cycleId: string) => {
    const { data, error } = await supabase.rpc('open_audit_cycle', { p_cycle_id: cycleId })
    if (error) alert(error.message)
    else { alert(`Audit opened. ${data} items created.`); fetchCycles() }
  }

  const handleClose = async (cycleId: string) => {
    if (!confirm('Close this audit cycle? This locks all items.')) return
    const { data, error } = await supabase.rpc('close_audit_cycle', { p_cycle_id: cycleId })
    if (error) alert(error.message)
    else { alert(`Audit closed. ${data?.length || 0} discrepancies found.`); fetchCycles() }
  }

  const viewItems = async (cycle: AuditCycle) => {
    setSelectedCycle(cycle)
    const { data } = await supabase
      .from('audit_items')
      .select('*, assets(name, asset_tag, location)')
      .eq('audit_cycle_id', cycle.id)
      .order('result')
    setAuditItems((data || []) as unknown as AuditItem[])

    const { data: assignments } = await supabase
      .from('audit_assignments')
      .select('auditor_id')
      .eq('audit_cycle_id', cycle.id)
    
    if (assignments) {
      const ids = assignments.map(a => a.auditor_id)
      const names = auditors.filter(a => ids.includes(a.id)).map(a => a.name)
      setCycleAuditors(names)
    }
  }

  const handleVerify = async (itemId: string, result: 'VERIFIED' | 'MISSING' | 'DAMAGED') => {
    const notes = result !== 'VERIFIED' ? prompt('Notes (optional):') : null
    const { error } = await supabase.rpc('verify_audit_item', {
      p_item_id: itemId, p_result: result, p_notes: notes || null,
    })
    if (error) alert(error.message)
    else if (selectedCycle) viewItems(selectedCycle)
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Create Audit Cycle</button>
        </div>
      )}

      {showForm && isAdmin && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>New Audit Cycle</h3>
          {error && <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠ {error}</div>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Cycle Name *</label>
                <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Q3 2026 Audit" />
              </div>
              <div className="form-group">
                <label className="form-label">Scope</label>
                <select className="form-select" value={formData.scope_id} onChange={e => setFormData({...formData, scope_id: e.target.value})}>
                  <option value="">All (no filter)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input className="form-input" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input className="form-input" type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Assign Auditors</label>
              <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                {auditors.map(a => (
                  <label key={a.id} className="form-checkbox-group" style={{ background: 'var(--bg-surface-raised)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
                    <input type="checkbox" className="form-checkbox" checked={formData.auditor_ids.includes(a.id)}
                      onChange={e => {
                        if (e.target.checked) setFormData({...formData, auditor_ids: [...formData.auditor_ids, a.id]})
                        else setFormData({...formData, auditor_ids: formData.auditor_ids.filter(id => id !== a.id)})
                      }} />
                    <span className="text-sm">{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-sm">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Cycle'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Cycles list */}
      <div className="data-table-wrapper" style={{ marginBottom: 'var(--space-xl)' }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Scope</th><th>Period</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {cycles.length === 0 ? (
              <tr><td colSpan={5} className="data-table-empty">No audit cycles</td></tr>
            ) : cycles.map(c => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-sm text-secondary">{departments.find(d => d.id === c.scope_id)?.name || 'All'}</td>
                <td className="text-sm">{c.start_date} → {c.end_date}</td>
                <td><span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span></td>
                <td>
                  <div className="flex gap-xs">
                    <button className="btn btn-ghost btn-sm" onClick={() => viewItems(c)}>View Items</button>
                    {isAdmin && c.status === 'DRAFT' && <button className="btn btn-primary btn-sm" onClick={() => handleOpen(c.id)}>Open</button>}
                    {isAdmin && c.status === 'OPEN' && <button className="btn btn-danger btn-sm" onClick={() => handleClose(c.id)}>Close</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Items Detail */}
      {selectedCycle && (
        <div className="mt-8 border border-border rounded-xl bg-card text-card-foreground p-6 shadow-sm">
          {/* Header Block */}
          <div className="flex flex-col gap-2 p-4 border border-border rounded-lg bg-muted/30 mb-6">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-lg">{selectedCycle.name} - {departments.find(d => d.id === selectedCycle.scope_id)?.name || 'All Departments'} - {selectedCycle.start_date} to {selectedCycle.end_date}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCycle(null)}>Close View</button>
            </div>
            {cycleAuditors.length > 0 && (
              <p className="text-sm text-muted-foreground">Auditors: {cycleAuditors.join(', ')}</p>
            )}
          </div>

          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-3 font-medium text-sm">Asset</th>
                  <th className="p-3 font-medium text-sm">Expected location</th>
                  <th className="p-3 font-medium text-sm text-center">Verification</th>
                </tr>
              </thead>
              <tbody>
                {auditItems.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No items in this audit cycle.</td></tr>
                ) : auditItems.map(item => {
                  const asset = item.assets as unknown as { name: string; asset_tag: string; location: string | null } | null
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <div className="font-medium text-sm">{asset?.asset_tag} {asset?.name}</div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {asset?.location || 'Unknown'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex gap-2 justify-center items-center">
                          {selectedCycle.status === 'OPEN' ? (
                            <>
                              <button 
                                className={`px-4 py-1 text-xs font-medium rounded-full border transition-colors ${item.result === 'VERIFIED' ? 'border-green-500 text-green-500 bg-green-500/10' : 'border-border text-muted-foreground hover:bg-muted'}`}
                                onClick={() => handleVerify(item.id, 'VERIFIED')}
                              >
                                Verified
                              </button>
                              <button 
                                className={`px-4 py-1 text-xs font-medium rounded-full border transition-colors ${item.result === 'MISSING' ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-border text-muted-foreground hover:bg-muted'}`}
                                onClick={() => handleVerify(item.id, 'MISSING')}
                              >
                                Missing
                              </button>
                              <button 
                                className={`px-4 py-1 text-xs font-medium rounded-full border transition-colors ${item.result === 'DAMAGED' ? 'border-gray-400 text-gray-400 bg-gray-400/10' : 'border-border text-muted-foreground hover:bg-muted'}`}
                                onClick={() => handleVerify(item.id, 'DAMAGED')}
                              >
                                Damaged
                              </button>
                            </>
                          ) : (
                            <span className={`px-4 py-1 text-xs font-medium rounded-full border ${
                              item.result === 'VERIFIED' ? 'border-green-500 text-green-500 bg-green-500/10' : 
                              item.result === 'MISSING' ? 'border-red-500 text-red-500 bg-red-500/10' : 
                              item.result === 'DAMAGED' ? 'border-gray-400 text-gray-400 bg-gray-400/10' : 
                              'border-border text-muted-foreground'
                            }`}>
                              {item.result}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Banner */}
          {(() => {
            const discrepancies = auditItems.filter(i => i.result === 'MISSING' || i.result === 'DAMAGED').length;
            if (discrepancies > 0) {
              return (
                <div className="bg-yellow-950/40 border border-yellow-700/50 text-yellow-500 text-sm font-medium p-3 rounded-lg mb-6">
                  {discrepancies} assets flagged - discrepancy report generated automatically
                </div>
              )
            }
            return null;
          })()}

          {/* Actions */}
          {selectedCycle.status === 'OPEN' && isAdmin && (
            <button 
              className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => handleClose(selectedCycle.id)}
            >
              Close audit cycle
            </button>
          )}
        </div>
      )}
    </div>
  )
}
