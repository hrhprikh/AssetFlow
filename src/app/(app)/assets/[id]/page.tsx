'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../../layout'
import type { Asset, Allocation, Booking, MaintenanceRequest, AuditItem, ActivityLog, AssetAttachment } from '@/lib/types'
import { QRCodeSVG } from 'qrcode.react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Tab = 'overview' | 'allocations' | 'bookings' | 'maintenance' | 'audits' | 'logs'

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useApp()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([])
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [attachment, setAttachment] = useState<AssetAttachment | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const assetId = params.id as string

  const fetchAsset = useCallback(async () => {
    const { data } = await supabase
      .from('assets')
      .select('*, asset_categories(name), departments(name)')
      .eq('id', assetId)
      .single()
    if (data) setAsset(data as unknown as Asset)

    // Fetch all related data
    const [allocRes, bookRes, maintRes, auditRes, logRes, attRes] = await Promise.all([
      supabase.from('allocations').select('*, profiles!allocations_holder_id_fkey(name, email)').eq('asset_id', assetId).order('created_at', { ascending: false }),
      supabase.from('bookings').select('*, profiles!bookings_requester_id_fkey(name)').eq('asset_id', assetId).order('start_at', { ascending: false }),
      supabase.from('maintenance_requests').select('*, profiles!maintenance_requests_raised_by_fkey(name)').eq('asset_id', assetId).order('created_at', { ascending: false }),
      supabase.from('audit_items').select('*, audit_cycles(name, status)').eq('asset_id', assetId).order('verified_at', { ascending: false }),
      supabase.from('activity_logs').select('*, profiles!activity_logs_actor_id_fkey(name)').eq('entity_type', 'ASSET').eq('entity_id', assetId).order('created_at', { ascending: false }).limit(50),
      supabase.from('asset_attachments').select('*').eq('asset_id', assetId).order('created_at', { ascending: false }).limit(1)
    ])

    setAllocations((allocRes.data || []) as unknown as Allocation[])
    setBookings((bookRes.data || []) as unknown as Booking[])
    setMaintenance((maintRes.data || []) as unknown as MaintenanceRequest[])
    setAuditItems((auditRes.data || []) as unknown as AuditItem[])
    setLogs((logRes.data || []) as unknown as ActivityLog[])
    if (attRes.data && attRes.data.length > 0) setAttachment(attRes.data[0] as unknown as AssetAttachment)
    setLoading(false)
  }, [supabase, assetId])

  useEffect(() => { fetchAsset() }, [fetchAsset])

  const getBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      'AVAILABLE': 'badge-available', 'ALLOCATED': 'badge-allocated', 'RESERVED': 'badge-reserved',
      'UNDER_MAINTENANCE': 'badge-under-maintenance', 'LOST': 'badge-lost', 'RETIRED': 'badge-retired', 'DISPOSED': 'badge-disposed',
    }
    return map[status] || 'badge-active'
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>
  if (!asset) return <div className="empty-state"><h3 className="empty-state-title">Asset not found</h3></div>

  const cat = asset.asset_categories as unknown as { name: string } | null
  const dept = asset.departments as unknown as { name: string } | null

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push('/assets')} style={{ marginBottom: 'var(--space-md)' }}>
        ← Back to Directory
      </button>

      {/* Asset Summary Card */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div>
            <div className="flex items-center gap-md">
              <h2 style={{ fontSize: '22px', fontWeight: 700 }}>{asset.name}</h2>
              <span className={`badge ${getBadgeClass(asset.status)}`}>{asset.status.replace('_', ' ')}</span>
            </div>
            <p className="text-sm text-muted" style={{ marginTop: '4px', fontFamily: 'var(--font-mono)' }}>{asset.asset_tag}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowQR(true)}>View QR Code</Button>
            {asset.is_bookable && <span className="badge badge-active flex items-center px-3">Bookable</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-lg)', marginTop: 'var(--space-lg)' }}>
          <div><div className="text-sm text-muted">Category</div><div className="font-medium">{cat?.name || '—'}</div></div>
          <div><div className="text-sm text-muted">Serial Number</div><div className="font-medium">{asset.serial_number || '—'}</div></div>
          <div><div className="text-sm text-muted">Condition</div><div className="font-medium">{asset.condition || '—'}</div></div>
          <div><div className="text-sm text-muted">Location</div><div className="font-medium">{asset.location || '—'}</div></div>
          <div><div className="text-sm text-muted">Department</div><div className="font-medium">{dept?.name || '—'}</div></div>
          <div><div className="text-sm text-muted">Acquisition Date</div><div className="font-medium">{asset.acquisition_date || '—'}</div></div>
          <div><div className="text-sm text-muted">Acquisition Cost</div><div className="font-medium">{asset.acquisition_cost ? `₹${Number(asset.acquisition_cost).toLocaleString()}` : '—'}</div></div>
          <div><div className="text-sm text-muted">Registered</div><div className="font-medium">{new Date(asset.created_at).toLocaleDateString()}</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(['overview', 'allocations', 'bookings', 'maintenance', 'audits', 'logs'] as Tab[]).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'allocations' && allocations.length > 0 && <span className="text-muted" style={{ marginLeft: '4px' }}>({allocations.length})</span>}
            {t === 'bookings' && bookings.length > 0 && <span className="text-muted" style={{ marginLeft: '4px' }}>({bookings.length})</span>}
            {t === 'maintenance' && maintenance.length > 0 && <span className="text-muted" style={{ marginLeft: '4px' }}>({maintenance.length})</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
            <div className="kpi-card" style={{ '--kpi-color': 'var(--color-info)' } as React.CSSProperties}>
              <div className="kpi-value">{allocations.length}</div>
              <div className="kpi-label">Total Allocations</div>
            </div>
            <div className="kpi-card" style={{ '--kpi-color': 'var(--color-accent)' } as React.CSSProperties}>
              <div className="kpi-value">{bookings.length}</div>
              <div className="kpi-label">Total Bookings</div>
            </div>
            <div className="kpi-card" style={{ '--kpi-color': 'var(--color-warning)' } as React.CSSProperties}>
              <div className="kpi-value">{maintenance.length}</div>
              <div className="kpi-label">Maintenance Requests</div>
            </div>
            <div className="kpi-card" style={{ '--kpi-color': 'var(--color-secondary)' } as React.CSSProperties}>
              <div className="kpi-value">{auditItems.length}</div>
              <div className="kpi-label">Audit Records</div>
            </div>
          </div>
          {attachment && attachment.file_type?.startsWith('image/') && (
            <div className="card max-w-sm">
              <h3 className="font-semibold mb-2">Asset Photo</h3>
              <img src={attachment.file_url} alt="Asset" className="w-full h-auto rounded-lg border shadow-sm object-cover" />
            </div>
          )}
          {attachment && !attachment.file_type?.startsWith('image/') && (
            <div className="card max-w-sm flex items-center justify-between">
              <h3 className="font-semibold">Asset Document</h3>
              <a href={attachment.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View File</a>
            </div>
          )}
        </div>
      )}

      {tab === 'allocations' && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Holder</th><th>Allocated At</th><th>Expected Return</th><th>Returned At</th><th>Status</th><th>Condition</th></tr></thead>
            <tbody>
              {allocations.length === 0 ? <tr><td colSpan={6} className="data-table-empty">No allocations</td></tr> :
              allocations.map(a => {
                const holder = a.profiles as unknown as { name: string; email: string } | null
                return (
                  <tr key={a.id}>
                    <td><div className="font-medium">{holder?.name}</div><div className="text-sm text-muted">{holder?.email}</div></td>
                    <td className="text-sm">{new Date(a.allocated_at).toLocaleDateString()}</td>
                    <td className="text-sm">{a.expected_return_at ? new Date(a.expected_return_at).toLocaleDateString() : '—'}</td>
                    <td className="text-sm">{a.returned_at ? new Date(a.returned_at).toLocaleDateString() : '—'}</td>
                    <td><span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span></td>
                    <td className="text-sm">{a.return_condition || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Requester</th><th>Start</th><th>End</th><th>Purpose</th><th>Status</th></tr></thead>
            <tbody>
              {bookings.length === 0 ? <tr><td colSpan={5} className="data-table-empty">No bookings</td></tr> :
              bookings.map(b => {
                const requester = b.profiles as unknown as { name: string } | null
                return (
                  <tr key={b.id}>
                    <td className="text-sm">{requester?.name}</td>
                    <td className="text-sm">{new Date(b.start_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-sm">{new Date(b.end_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-sm text-secondary">{b.purpose || '—'}</td>
                    <td><span className={`badge badge-${b.status.toLowerCase()}`}>{b.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Raised By</th><th>Issue</th><th>Priority</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {maintenance.length === 0 ? <tr><td colSpan={5} className="data-table-empty">No maintenance requests</td></tr> :
              maintenance.map(m => {
                const raiser = m.profiles as unknown as { name: string } | null
                return (
                  <tr key={m.id}>
                    <td className="text-sm">{raiser?.name}</td>
                    <td className="text-sm truncate" style={{ maxWidth: '250px' }}>{m.issue}</td>
                    <td><span className={`badge ${m.priority === 'CRITICAL' ? 'badge-danger' : m.priority === 'HIGH' ? 'badge-allocated' : 'badge-reserved'}`}>{m.priority}</span></td>
                    <td><span className={`badge badge-${m.status.toLowerCase().replace('_', '-')}`}>{m.status.replace('_', ' ')}</span></td>
                    <td className="text-sm text-muted">{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audits' && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Audit Cycle</th><th>Result</th><th>Notes</th><th>Verified At</th></tr></thead>
            <tbody>
              {auditItems.length === 0 ? <tr><td colSpan={4} className="data-table-empty">No audit records</td></tr> :
              auditItems.map(ai => {
                const cycle = ai.audit_cycles as unknown as { name: string; status: string } | null
                return (
                  <tr key={ai.id}>
                    <td className="font-medium">{cycle?.name}</td>
                    <td><span className={`badge badge-${ai.result.toLowerCase()}`}>{ai.result}</span></td>
                    <td className="text-sm text-secondary">{ai.notes || '—'}</td>
                    <td className="text-sm text-muted">{ai.verified_at ? new Date(ai.verified_at).toLocaleDateString() : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'logs' && (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={4} className="data-table-empty">No logs</td></tr> :
              logs.map(l => {
                const actor = l.profiles as unknown as { name: string } | null
                return (
                  <tr key={l.id}>
                    <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-sm">{actor?.name || 'System'}</td>
                    <td><span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-primary)' }}>{l.action}</span></td>
                    <td className="text-sm text-muted truncate" style={{ maxWidth: '250px' }}>{l.metadata ? JSON.stringify(l.metadata) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-[400px] text-center">
          <DialogHeader>
            <DialogTitle>Asset QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <QRCodeSVG value={asset.asset_tag} size={200} />
            </div>
            <p className="text-lg font-mono font-semibold">{asset.asset_tag}</p>
            <p className="text-sm text-muted-foreground">Scan this code to quickly pull up the asset details.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
