'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { DashboardKPIs, Allocation, Asset, Profile } from '@/lib/types'
import BookingForm from '@/components/forms/BookingForm'
import MaintenanceForm from '@/components/forms/MaintenanceForm'
import TransferReturnForm from '@/components/forms/TransferReturnForm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Building2, Users, TrendingUp, Package, Link as LinkIcon, 
  CalendarRange, Wrench, ClipboardCheck, RefreshCw, AlertTriangle, CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  
  const [activeModal, setActiveModal] = useState<'NONE' | 'BOOK' | 'MAINTAIN' | 'TRANSFER'>('NONE')

  const supabase = createClient()

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!profile) return

    const fetchDashboard = async () => {
      const { data: kpiData } = await supabase.rpc('get_dashboard_kpis')
      if (kpiData && isMounted.current) setKpis(kpiData as unknown as DashboardKPIs)

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
        if (overdue && isMounted.current) setOverdueItems(overdue as unknown as (Allocation & { assets: Asset })[])
      }

      if (profile.role === 'EMPLOYEE') {
        const [allocsRes, empRes] = await Promise.all([
          supabase.from('allocations').select('*, assets(*)').eq('holder_id', profile.id).eq('status', 'ACTIVE'),
          supabase.from('profiles').select('id, name, email').eq('status', 'ACTIVE').order('name')
        ])
        if (isMounted.current) {
          if (allocsRes.data) setMyAssets(allocsRes.data as unknown as (Allocation & { assets: Asset })[])
          if (empRes.data) setEmployees(empRes.data as Profile[])
        }
      }

      if (isMounted.current) {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [supabase, profile])

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const renderAdminDashboard = () => (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Admin Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button asChild><Link href="/organization"><Building2 className="mr-2 h-4 w-4" /> Organization Setup</Link></Button>
          <Button asChild variant="secondary"><Link href="/organization?tab=employees"><Users className="mr-2 h-4 w-4" /> Employee Directory</Link></Button>
          <Button asChild variant="secondary"><Link href="/reports"><TrendingUp className="mr-2 h-4 w-4" /> View Reports</Link></Button>
        </CardContent>
      </Card>
      {renderOrgKPIs('Organization Overview')}
      {renderOverdueReturns()}
    </div>
  )

  const renderAssetManagerDashboard = () => (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Manager Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button asChild><Link href="/assets?action=register"><Package className="mr-2 h-4 w-4" /> Register Asset</Link></Button>
          <Button asChild variant="secondary"><Link href="/allocations"><LinkIcon className="mr-2 h-4 w-4" /> Allocate Asset</Link></Button>
          <Button asChild variant="secondary"><Link href="/maintenance"><Wrench className="mr-2 h-4 w-4" /> Process Maintenance</Link></Button>
          <Button asChild variant="secondary"><Link href="/audits"><ClipboardCheck className="mr-2 h-4 w-4" /> Process Audits</Link></Button>
        </CardContent>
      </Card>
      {renderOrgKPIs('Asset Overview')}
      {renderOverdueReturns()}
    </div>
  )

  const renderDeptHeadDashboard = () => (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Department Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button asChild><Link href="/bookings?action=new"><CalendarRange className="mr-2 h-4 w-4" /> Book Shared Resource</Link></Button>
          <Button asChild variant="secondary"><Link href="/assets"><Package className="mr-2 h-4 w-4" /> View Assets</Link></Button>
          <Button asChild variant="secondary"><Link href="/transfers"><RefreshCw className="mr-2 h-4 w-4" /> Approve Transfers</Link></Button>
        </CardContent>
      </Card>
      {renderDeptKPIs()}
    </div>
  )

  const renderEmployeeDashboard = () => (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button onClick={() => setActiveModal('BOOK')}><CalendarRange className="mr-2 h-4 w-4" /> Book Resource</Button>
          <Button onClick={() => setActiveModal('MAINTAIN')} variant="secondary"><Wrench className="mr-2 h-4 w-4" /> Raise Maintenance</Button>
          <Button onClick={() => setActiveModal('TRANSFER')} variant="secondary"><RefreshCw className="mr-2 h-4 w-4" /> Request Transfer / Return</Button>
        </CardContent>
      </Card>
      {renderPersonalKPIs()}
      {renderMyAssets()}
    </div>
  )

  const renderOrgKPIs = (title: string) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard icon={CheckCircle2} title="Available" value={kpis?.available_assets} />
        <KpiCard icon={LinkIcon} title="Allocated" value={kpis?.allocated_assets} />
        <KpiCard icon={Wrench} title="Maintenance" value={kpis?.under_maintenance} />
        <KpiCard icon={CalendarRange} title="Bookings" value={kpis?.active_bookings} />
        <KpiCard icon={AlertTriangle} title="Overdue" value={kpis?.overdue_returns} destructive />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard icon={RefreshCw} title="Pending Transfers" value={kpis?.pending_transfers} />
        <KpiCard icon={Wrench} title="Pending Maintenance" value={kpis?.pending_maintenance} />
        <KpiCard icon={Package} title="Total Assets" value={kpis?.total_assets} />
      </div>
    </div>
  )

  const renderDeptKPIs = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight">Department Overview</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Package} title="Department Assets" value={kpis?.total_assets} />
        <KpiCard icon={LinkIcon} title="Allocated Assets" value={kpis?.allocated_assets} />
        <KpiCard icon={CalendarRange} title="Active Bookings" value={kpis?.active_bookings} />
        <KpiCard icon={RefreshCw} title="Pending Transfers" value={kpis?.pending_transfers} />
      </div>
    </div>
  )

  const renderPersonalKPIs = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight">My Overview</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard icon={Package} title="My Allocated Assets" value={kpis?.allocated_assets} />
        <KpiCard icon={CalendarRange} title="My Active Bookings" value={kpis?.active_bookings} />
        <KpiCard icon={Wrench} title="My Pending Maintenance" value={kpis?.pending_maintenance} />
      </div>
    </div>
  )

  const renderOverdueReturns = () => {
    if (overdueItems.length === 0) return null
    return (
      <Card className="border-destructive">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Overdue Returns
          </CardTitle>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
            {overdueItems.length}
          </span>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead className="text-right">Overdue By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueItems.map((item) => {
                const asset = item.assets as unknown as Asset
                const expected = new Date(item.expected_return_at!)
                const overdueDays = Math.floor((Date.now() - expected.getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{asset?.name}</div>
                      <div className="text-xs text-muted-foreground">{asset?.asset_tag}</div>
                    </TableCell>
                    <TableCell>{expected.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                        {overdueDays} day{overdueDays !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  const renderMyAssets = () => (
    <Card id="my-assets">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>My Current Assets</CardTitle>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {myAssets.length}
        </span>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Allocated On</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  You have no active asset allocations.
                </TableCell>
              </TableRow>
            ) : myAssets.map((item) => {
              const asset = item.assets as unknown as Asset
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    <Link href={`/assets/${asset.id}`} className="hover:underline hover:text-primary">
                      {asset?.asset_tag}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{asset?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(item.allocated_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowTransferFor(asset)}>Transfer</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowReturnFor(asset)}>Return</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back, {profile?.name?.split(' ')[0] || 'User'} 👋
        </h2>
        <p className="text-muted-foreground mt-2">
          Here&apos;s an overview of your asset management system
        </p>
      </div>

      {profile?.role === 'ADMIN' && renderAdminDashboard()}
      {profile?.role === 'ASSET_MANAGER' && renderAssetManagerDashboard()}
      {profile?.role === 'DEPARTMENT_HEAD' && renderDeptHeadDashboard()}
      {profile?.role === 'EMPLOYEE' && renderEmployeeDashboard()}

      {/* Transfer Modal */}
      <Dialog open={!!showTransferFor} onOpenChange={(open) => !open && setShowTransferFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Transfer: {showTransferFor?.name}</DialogTitle>
          </DialogHeader>
          {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleRequestTransfer} className="space-y-4">
            <div className="space-y-2">
              <Label>Transfer To *</Label>
              <Select value={transferTargetId} onValueChange={setTransferTargetId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select Employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Why is this transfer needed?" required />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowTransferFor(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return Modal */}
      <Dialog open={!!showReturnFor} onOpenChange={(open) => !open && setShowReturnFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Asset: {showReturnFor?.name}</DialogTitle>
          </DialogHeader>
          {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleReturn} className="space-y-4">
            <div className="space-y-2">
              <Label>Return Condition</Label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Poor">Poor</SelectItem>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Return Notes</Label>
              <Textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Any issues to report?" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowReturnFor(null)}>Cancel</Button>
              <Button type="submit" variant="default" disabled={saving}>{saving ? 'Returning...' : 'Confirm Return'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Global Quick Action Modals */}
      <Dialog open={activeModal === 'BOOK'} onOpenChange={(open) => !open && setActiveModal('NONE')}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>New Booking</DialogTitle>
          </DialogHeader>
          <BookingForm 
            onSuccess={() => { setActiveModal('NONE'); alert('Booking created successfully!') }} 
            onCancel={() => setActiveModal('NONE')} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'MAINTAIN'} onOpenChange={(open) => !open && setActiveModal('NONE')}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Raise Maintenance Request</DialogTitle>
          </DialogHeader>
          <MaintenanceForm 
            onSuccess={() => { setActiveModal('NONE'); alert('Maintenance request raised successfully!') }} 
            onCancel={() => setActiveModal('NONE')} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === 'TRANSFER'} onOpenChange={(open) => !open && setActiveModal('NONE')}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Transfer / Return</DialogTitle>
          </DialogHeader>
          <TransferReturnForm 
            onSuccess={() => { 
              setActiveModal('NONE')
              alert('Request submitted successfully!')
              if (typeof window !== 'undefined') window.location.reload()
            }} 
            onCancel={() => setActiveModal('NONE')} 
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KpiCard({ icon: Icon, title, value, destructive }: { icon: React.ElementType, title: string, value?: number, destructive?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", destructive ? "text-destructive" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value ?? 0}</div>
      </CardContent>
    </Card>
  )
}
