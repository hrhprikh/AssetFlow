'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { TransferRequest } from '@/lib/types'

export default function TransfersPage() {
  const { profile } = useApp()
  const [transfers, setTransfers] = useState<TransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const isManager = profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER' || profile?.role === 'DEPARTMENT_HEAD'

  const fetchTransfers = useCallback(async () => {
    if (!profile) return

    let query = supabase
      .from('transfer_requests')
      .select('*, assets!inner(name, asset_tag, current_department_id), requester:profiles!transfer_requests_requested_by_fkey(name), target:profiles!transfer_requests_target_holder_id_fkey(name)')
      .order('created_at', { ascending: false })

    if (profile.role === 'DEPARTMENT_HEAD') {
      query = query.eq('assets.current_department_id', profile.department_id)
    }

    const { data } = await query
    setTransfers((data || []) as unknown as TransferRequest[])
    setLoading(false)
  }, [supabase, profile])

  useEffect(() => { fetchTransfers() }, [fetchTransfers])

  const handleApprove = async (id: string) => {
    const { error } = await supabase.rpc('approve_transfer', { p_transfer_id: id })
    if (error) alert(error.message)
    else fetchTransfers()
  }

  const handleReject = async (id: string) => {
    const notes = prompt('Rejection reason (optional):')
    const { error } = await supabase.rpc('reject_transfer', { p_transfer_id: id, p_decision_notes: notes || null })
    if (error) alert(error.message)
    else fetchTransfers()
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Requested By</th>
              <th>Transfer To</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Date</th>
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr><td colSpan={isManager ? 7 : 6} className="data-table-empty">No transfer requests</td></tr>
            ) : transfers.map(t => {
              const asset = t.assets as unknown as { name: string; asset_tag: string } | null
              const requester = t.requester as unknown as { name: string } | null
              const target = t.target as unknown as { name: string } | null
              return (
                <tr key={t.id}>
                  <td>
                    <div className="font-medium">{asset?.name}</div>
                    <div className="text-sm text-muted">{asset?.asset_tag}</div>
                  </td>
                  <td className="text-sm">{requester?.name}</td>
                  <td className="text-sm">{target?.name}</td>
                  <td className="text-sm text-secondary truncate" style={{ maxWidth: '200px' }}>{t.reason || '—'}</td>
                  <td><span className={`badge badge-${t.status.toLowerCase()}`}>{t.status}</span></td>
                  <td className="text-sm text-muted">{new Date(t.created_at).toLocaleDateString()}</td>
                  {isManager && (
                    <td>
                      {t.status === 'REQUESTED' && (
                        <div className="flex gap-xs">
                          <button className="btn btn-primary btn-sm" onClick={() => handleApprove(t.id)}>Approve</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleReject(t.id)}>Reject</button>
                        </div>
                      )}
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
