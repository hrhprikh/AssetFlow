'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { DashboardKPIs, Allocation, Asset, Profile } from '@/lib/types'
import Link from 'next/link'

export default function DashboardPage() {
  const { profile } = useApp()
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [overdueItems, setOverdueItems] = useState<(Allocation & { assets: Asset })[]>([])
  const [myAssets, setMyAssets] = useState<(Allocation & { assets: Asset })[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Profile[]>([])
  
  const [showTransferFor, setShowTransferFor] = useState<Asset | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  
  const [showReturnFor, setShowReturnFor] = useState<Asset | null>(null)
  const [returnCondition, setReturnCondition] = useState('Good')
  const [returnNotes, setReturnNotes] = useState('')
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return

    const fetchDashboard = async () => {
      // Fetch KPIs via RPC
      const { data: kpiData } = await supabase.rpc('get_dashboard_kpis')
      if (kpiData) setKpis(kpiData as unknown as DashboardKPIs)

      if (profile.role === 'ADMIN' || profile.role === 'ASSET_MANAGER') {
        const { data: overdue } = await supabase
          .from('allocations')
          .select('*, assets(name, asset_tag)')
          .eq('status', 'ACTIVE')
          .not('expected_return_at', 'is', null)
          .lt('expected_return_at', new Date().toISOString())
          .is('returned_at', null)
          .order('expected_return_at', { ascending: true })
          .limit(10)
        if (overdue) setOverdueItems(overdue as unknown as (Allocation & { assets: Asset })[])
      }

      if (profile.role === 'EMPLOYEE') {
        const [allocsRes, empRes] = await Promise.all([
          supabase.from('allocations').select('*, assets(*)').eq('holder_id', profile.id).eq('status', 'ACTIVE'),
          supabase.from('profiles').select('id, name, email').eq('status', 'ACTIVE').order('name')
        ])
        if (allocsRes.data) setMyAssets(allocsRes.data as unknown as (Allocation & { assets: Asset })[])
        if (empRes.data) setEmployees(empRes.data as Profile[])
      }

      setLoading(false)
    }

    fetchDashboard()
  }, [supabase, profile])

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  // --- ROLE BASED SUB-COMPONENTS ---
  const renderAdminDashboard = () => (
    <>
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header"><h3 className="card-title">Admin Quick Actions</h3></div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          <Link href="/organization" className="btn btn-primary">🏢 Organization Setup</Link>
          <Link href="/organization?tab=employees" className="btn btn-secondary">👥 Employee Directory</Link>
          <Link href="/reports" className="btn btn-secondary">📈 View Reports</Link>
        </div>
      </div>
      {renderOrgKPIs('Organization Overview')}
      {renderOverdueReturns()}
    </>
  )

  const renderAssetManagerDashboard = () => (
    <>
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header"><h3 className="card-title">Manager Quick Actions</h3></div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          <Link href="/assets?action=register" className="btn btn-primary">+ Register Asset</Link>
          <Link href="/allocations" className="btn btn-secondary">🔗 Allocate Asset</Link>
          <Link href="/maintenance" className="btn btn-secondary">🔧 Process Maintenance</Link>
          <Link href="/audits" className="btn btn-secondary">📋 Process Audits</Link>
        </div>
      </div>
      {renderOrgKPIs('Asset Overview')}
      {renderOverdueReturns()}
    </>
  )

  const renderDeptHeadDashboard = () => (
    <>
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header"><h3 className="card-title">Department Quick Actions</h3></div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          <Link href="/bookings?action=new" className="btn btn-primary">📅 Book Shared Resource</Link>
          <Link href="/assets" className="btn btn-secondary">📦 View Department Assets</Link>
          <Link href="/transfers" className="btn btn-secondary">🔄 Approve Transfers</Link>
        </div>
      </div>
      {renderDeptKPIs()}
    </>
  )

  const renderEmployeeDashboard = () => (
    <>
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card-header"><h3 className="card-title">Quick Actions</h3></div>
        <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
          <Link href="/bookings?action=new" className="btn btn-primary">📅 Book Resource</Link>
          <Link href="/maintenance" className="btn btn-secondary">🔧 Raise Maintenance</Link>
          <button onClick={() => document.getElementById('my-assets')?.scrollIntoView({ behavior: 'smooth' })} className="btn btn-secondary">🔄 Request Transfer / Return</button>
        </div>
      </div>
      {renderPersonalKPIs()}
      {renderMyAssets()}
    </>
  )

  // --- REUSABLE SECTIONS ---
  const renderOrgKPIs = (title: string) => (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-md)' }}>{title}</h3>
      <div className="kpi-grid">
        <KpiCard icon="✓" color="var(--color-success)" bgVar="var(--color-success-light)" value={kpis?.available_assets} label="Available Assets" />
        <KpiCard icon="🔗" color="var(--color-info)" bgVar="var(--color-info-light)" value={kpis?.allocated_assets} label="Allocated Assets" />
        <KpiCard icon="🔧" color="#a855f7" bgVar="rgba(168, 85, 247, 0.15)" value={kpis?.under_maintenance} label="Under Maintenance" />
        <KpiCard icon="📅" color="var(--color-accent)" bgVar="rgba(6, 182, 212, 0.15)" value={kpis?.active_bookings} label="Active Bookings" />
        <KpiCard icon="⚠" color="var(--color-danger)" bgVar="var(--color-danger-light)" value={kpis?.overdue_returns} label="Overdue Returns" />
        <KpiCard icon="🔄" color="var(--color-warning)" bgVar="var(--color-warning-light)" value={kpis?.pending_transfers} label="Pending Transfers" />
        <KpiCard icon="🛠" color="var(--color-warning)" bgVar="var(--color-warning-light)" value={kpis?.pending_maintenance} label="Pending Maintenance" />
        <KpiCard icon="📦" color="var(--color-primary)" bgVar="var(--color-primary-light)" value={kpis?.total_assets} label="Total Assets" />
      </div>
    </div>
  )

  const renderDeptKPIs = () => (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-md)' }}>Department Overview</h3>
      <div className="kpi-grid">
        <KpiCard icon="📦" color="var(--color-primary)" bgVar="var(--color-primary-light)" value={kpis?.total_assets} label="Department Assets" />
        <KpiCard icon="🔗" color="var(--color-info)" bgVar="var(--color-info-light)" value={kpis?.allocated_assets} label="Allocated Assets" />
        <KpiCard icon="📅" color="var(--color-accent)" bgVar="rgba(6, 182, 212, 0.15)" value={kpis?.active_bookings} label="Active Bookings" />
        <KpiCard icon="🔄" color="var(--color-warning)" bgVar="var(--color-warning-light)" value={kpis?.pending_transfers} label="Pending Transfers" />
      </div>
    </div>
  )

  const renderPersonalKPIs = () => (
    <div style={{ marginBottom: 'var(--space-xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-md)' }}>My Overview</h3>
      <div className="kpi-grid">
        <KpiCard icon="📦" color="var(--color-primary)" bgVar="var(--color-primary-light)" value={kpis?.allocated_assets} label="My Allocated Assets" />
        <KpiCard icon="📅" color="var(--color-accent)" bgVar="rgba(6, 182, 212, 0.15)" value={kpis?.active_bookings} label="My Active Bookings" />
        <KpiCard icon="🛠" color="var(--color-warning)" bgVar="var(--color-warning-light)" value={kpis?.pending_maintenance} label="My Pending Maintenance" />
      </div>
    </div>
  )

  const renderOverdueReturns = () => {
    if (overdueItems.length === 0) return null
    return (
      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <div className="card-header">
          <h3 className="card-title" style={{ color: 'var(--color-danger)' }}>⚠ Overdue Returns</h3>
          <span className="badge badge-danger">{overdueItems.length}</span>
        </div>
        <div className="data-table-wrapper" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr><th>Asset</th><th>Expected Return</th><th>Overdue By</th></tr>
            </thead>
            <tbody>
              {overdueItems.map((item) => {
                const asset = item.assets as unknown as Asset
                const expected = new Date(item.expected_return_at!)
                const overdueDays = Math.floor((Date.now() - expected.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-medium">{asset?.name}</div>
                      <div className="text-sm text-muted">{asset?.asset_tag}</div>
                    </td>
                    <td className="text-sm">{expected.toLocaleDateString()}</td>
                    <td>
                      <span className="badge badge-danger">{overdueDays} day{overdueDays !== 1 ? 's' : ''}</span>
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

  const renderMyAssets = () => (
    <div className="card" id="my-assets">
      <div className="card-header">
        <h3 className="card-title">My Current Assets</h3>
        <span className="badge badge-info">{myAssets.length}</span>
      </div>
      <div className="data-table-wrapper" style={{ border: 'none' }}>
        <table className="data-table">
          <thead>
            <tr><th>Asset Tag</th><th>Name</th><th>Allocated On</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {myAssets.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 'var(--space-xl)' }}>You have no active asset allocations.</td></tr>
            ) : myAssets.map((item) => {
              const asset = item.assets as unknown as Asset
              return (
                <tr key={item.id}>
                  <td>
                    <Link href={`/assets/${asset.id}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}>
                      {asset?.asset_tag}
                    </Link>
                  </td>
                  <td className="font-medium">{asset?.name}</td>
                  <td className="text-sm">{new Date(item.allocated_at).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowTransferFor(asset)}>Transfer</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowReturnFor(asset)}>Return</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  const handleRequestTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showTransferFor) return
    setSaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('request_transfer', {
      p_asset_id: showTransferFor.id,
      p_target_holder_type: 'EMPLOYEE',
      p_target_holder_id: transferTargetId,
      p_reason: transferReason || null
    })
    if (rpcError) setError(rpcError.message)
    else {
      setShowTransferFor(null)
      setTransferTargetId('')
      setTransferReason('')
      alert('Transfer request submitted!')
    }
    setSaving(false)
  }

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showReturnFor) return
    setSaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('return_asset', {
      p_asset_id: showReturnFor.id,
      p_return_condition: returnCondition,
      p_return_notes: returnNotes || null
    })
    if (rpcError) setError(rpcError.message)
    else {
      setShowReturnFor(null)
      setReturnCondition('Good')
      setReturnNotes('')
      setMyAssets(prev => prev.filter(a => a.asset_id !== showReturnFor.id))
      alert('Asset returned successfully!')
    }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
          Welcome back, {profile?.name?.split(' ')[0] || 'User'} 👋
        </h2>
        <p className="text-secondary text-sm">
          Here&apos;s an overview of your asset management system
        </p>
      </div>

      {profile?.role === 'ADMIN' && renderAdminDashboard()}
      {profile?.role === 'ASSET_MANAGER' && renderAssetManagerDashboard()}
      {profile?.role === 'DEPARTMENT_HEAD' && renderDeptHeadDashboard()}
      {profile?.role === 'EMPLOYEE' && renderEmployeeDashboard()}

      {/* Transfer Modal */}
      {showTransferFor && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Request Transfer: {showTransferFor.name}</h3>
              <button className="modal-close" onClick={() => setShowTransferFor(null)}>✕</button>
            </div>
            {error && <div className="alert-banner alert-error" style={{ margin: 'var(--space-md) 0' }}>⚠ {error}</div>}
            <form onSubmit={handleRequestTransfer}>
              <div className="form-group">
                <label className="form-label">Transfer To *</label>
                <select className="form-select" value={transferTargetId} onChange={e => setTransferTargetId(e.target.value)} required>
                  <option value="">Select Employee...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.email})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Why is this transfer needed?" required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowTransferFor(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnFor && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Return Asset: {showReturnFor.name}</h3>
              <button className="modal-close" onClick={() => setShowReturnFor(null)}>✕</button>
            </div>
            {error && <div className="alert-banner alert-error" style={{ margin: 'var(--space-md) 0' }}>⚠ {error}</div>}
            <form onSubmit={handleReturn}>
              <div className="form-group">
                <label className="form-label">Return Condition</label>
                <select className="form-select" value={returnCondition} onChange={e => setReturnCondition(e.target.value)}>
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Return Notes</label>
                <textarea className="form-input" value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Any issues to report?" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowReturnFor(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Returning...' : 'Confirm Return'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, color, bgVar, value, label }: { icon: string, color: string, bgVar: string, value?: number, label: string }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color': color } as React.CSSProperties}>
      <div className="kpi-icon" style={{ background: bgVar, color }}>
        {icon}
      </div>
      <div className="kpi-value">{value ?? 0}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}
