'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { DashboardKPIs, Allocation, Asset } from '@/lib/types'
import Link from 'next/link'

export default function DashboardPage() {
  const { profile } = useApp()
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [overdueItems, setOverdueItems] = useState<(Allocation & { assets: Asset })[]>([])
  const [myAssets, setMyAssets] = useState<(Allocation & { assets: Asset })[]>([])
  const [loading, setLoading] = useState(true)
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
        const { data: myAllocations } = await supabase
          .from('allocations')
          .select('*, assets(*)')
          .eq('holder_id', profile.id)
          .eq('status', 'ACTIVE')
        if (myAllocations) setMyAssets(myAllocations as unknown as (Allocation & { assets: Asset })[])
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
          <Link href="/assets" className="btn btn-secondary">🔄 Request Transfer / Return</Link>
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
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">My Current Assets</h3>
        <span className="badge badge-info">{myAssets.length}</span>
      </div>
      <div className="data-table-wrapper" style={{ border: 'none' }}>
        <table className="data-table">
          <thead>
            <tr><th>Asset Tag</th><th>Name</th><th>Allocated On</th></tr>
          </thead>
          <tbody>
            {myAssets.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-muted" style={{ padding: 'var(--space-xl)' }}>You have no active asset allocations.</td></tr>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

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
