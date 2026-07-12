'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityLog } from '@/lib/types'

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*, profiles!activity_logs_actor_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs((data || []) as unknown as ActivityLog[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type.toLowerCase().includes(search.toLowerCase())
  )

  const getActionColor = (action: string) => {
    if (action.includes('REGISTERED') || action.includes('CREATED')) return 'var(--color-success)'
    if (action.includes('APPROVED') || action.includes('VERIFIED')) return 'var(--color-info)'
    if (action.includes('REJECTED') || action.includes('LOST')) return 'var(--color-danger)'
    if (action.includes('CHANGE') || action.includes('TRANSFER')) return 'var(--color-warning)'
    return 'var(--text-secondary)'
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      <div className="filter-bar">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input className="search-input" placeholder="Filter by action or entity type..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-md)' }}>Activity logs are immutable and cannot be edited.</p>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="data-table-empty">No logs found</td></tr>
            ) : filtered.map(log => {
              const actor = log.profiles as unknown as { name: string } | null
              return (
                <tr key={log.id}>
                  <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="text-sm">{actor?.name || 'System'}</td>
                  <td><span style={{ color: getActionColor(log.action), fontWeight: 600, fontSize: '13px' }}>{log.action}</span></td>
                  <td className="text-sm text-secondary">{log.entity_type}</td>
                  <td className="text-sm text-muted truncate" style={{ maxWidth: '250px' }}>
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
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
