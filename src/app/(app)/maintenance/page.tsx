'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { MaintenanceRequest } from '@/lib/types'
import MaintenanceForm from '@/components/forms/MaintenanceForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Wrench, Check, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MaintenancePage() {
  const { profile } = useApp()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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
  }, [fetchRequests])

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
    const map: Record<string, string> = { 
      LOW: 'bg-green-100 text-green-800 border-green-200', 
      MEDIUM: 'bg-blue-100 text-blue-800 border-blue-200', 
      HIGH: 'bg-orange-100 text-orange-800 border-orange-200', 
      CRITICAL: 'bg-red-100 text-red-800 border-red-200' 
    }
    return map[p] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getStatusBadge = (s: string) => {
    switch(s) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'APPROVED': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'TECHNICIAN_ASSIGNED': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'RESOLVED': return 'bg-green-100 text-green-800 border-green-200'
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Maintenance Requests</h2>
          <p className="text-muted-foreground mt-2">Track and manage asset maintenance and repairs.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Wrench className="mr-2 h-4 w-4" /> Raise Request
        </Button>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New Maintenance Request</DialogTitle>
          </DialogHeader>
          <MaintenanceForm 
            onSuccess={() => { setShowForm(false); fetchRequests() }} 
            onCancel={() => setShowForm(false)} 
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {isManager && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isManager ? 7 : 6} className="h-24 text-center text-muted-foreground">
                    No maintenance requests found
                  </TableCell>
                </TableRow>
              ) : requests.map(req => {
                const asset = req.assets as unknown as { name: string; asset_tag: string } | null
                const raiser = req.profiles as unknown as { name: string } | null
                return (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="font-medium">{asset?.name}</div>
                      <div className="text-xs text-muted-foreground">{asset?.asset_tag}</div>
                    </TableCell>
                    <TableCell className="text-sm">{raiser?.name}</TableCell>
                    <TableCell className="text-sm max-w-[250px] truncate" title={req.issue}>{req.issue}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", getPriorityBadge(req.priority))}>
                        {req.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", getStatusBadge(req.status))}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString()}
                    </TableCell>
                    {isManager && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {req.status === 'PENDING' && (
                            <>
                              <Button size="sm" variant="default" onClick={() => handleApprove(req.id)} title="Approve">
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(req.id)} title="Reject">
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {['APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'].includes(req.status) && (
                            <Button size="sm" variant="outline" onClick={() => handleResolve(req.id)} title="Resolve">
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve
                            </Button>
                          )}
                        </div>
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
