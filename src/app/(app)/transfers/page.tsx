'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { TransferRequest, Profile, Department } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TransfersPage() {
  const { profile } = useApp()
  const [transfers, setTransfers] = useState<TransferRequest[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const isManager = profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER' || profile?.role === 'DEPARTMENT_HEAD'

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchTransfers = useCallback(async () => {
    if (!profile) return

    let query = supabase
      .from('transfer_requests')
      .select('*, assets!inner(name, asset_tag, current_department_id), requester:profiles!transfer_requests_requested_by_fkey(name)')
      .order('created_at', { ascending: false })

    if (profile.role === 'DEPARTMENT_HEAD') {
      if (profile.department_id) {
        query = query.eq('assets.current_department_id', profile.department_id)
      }
    }

    const { data } = await query
    if (isMounted.current) {
      setTransfers((data || []) as unknown as TransferRequest[])
      setLoading(false)
    }
  }, [supabase, profile])

  useEffect(() => {
    fetchTransfers()
    const fetchMeta = async () => {
      const [profilesRes, deptsRes] = await Promise.all([
        supabase.from('profiles').select('id, name'),
        supabase.from('departments').select('id, name')
      ])
      if (isMounted.current) {
        setProfiles((profilesRes.data || []) as Profile[])
        setDepartments((deptsRes.data || []) as Department[])
      }
    }
    fetchMeta()
  }, [fetchTransfers, supabase])

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

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'REQUESTED': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200'
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const getTargetName = (t: TransferRequest) => {
    if (t.target_holder_type === 'EMPLOYEE') {
      return profiles.find(p => p.id === t.target_holder_id)?.name || 'Unknown Employee'
    } else {
      return departments.find(d => d.id === t.target_holder_id)?.name || 'Unknown Department'
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Asset Transfers</h2>
        <p className="text-muted-foreground mt-2">Manage requests to transfer assets between employees.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Transfer To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {isManager && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isManager ? 7 : 6} className="h-24 text-center text-muted-foreground">
                    No transfer requests found
                  </TableCell>
                </TableRow>
              ) : transfers.map(t => {
                const asset = t.assets as unknown as { name: string; asset_tag: string } | null
                const requester = t.requester as unknown as { name: string } | null
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{asset?.name}</div>
                      <div className="text-xs text-muted-foreground">{asset?.asset_tag}</div>
                    </TableCell>
                    <TableCell className="text-sm">{requester?.name}</TableCell>
                    <TableCell className="text-sm">{getTargetName(t)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={t.reason || ''}>{t.reason || '—'}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", getStatusBadge(t.status))}>
                        {t.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    {isManager && (
                      <TableCell className="text-right">
                        {t.status === 'REQUESTED' && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="default" onClick={() => handleApprove(t.id)} title="Approve">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReject(t.id)} title="Reject">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
