'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import { useSearchParams } from 'next/navigation'
import type { Asset, AssetCategory, Department } from '@/lib/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  'ALL', 'AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED'
]

export default function AssetsPage() {
  const { profile } = useApp()
  const searchParams = useSearchParams()
  const scope = searchParams.get('scope')
  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '', category_id: '', serial_number: '', acquisition_date: '',
    acquisition_cost: '', condition: 'New', location: '', is_bookable: false,
    department_id: 'NONE',
  })
  const supabase = createClient()
  const isManager = profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER'

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    if (!profile) return

    let query = supabase
      .from('assets')
      .select('*, asset_categories(name), departments(name)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'ALL') query = query.eq('status', statusFilter)
    if (categoryFilter !== 'ALL') query = query.eq('category_id', categoryFilter)

    if (scope === 'mine') {
      const { data: allocs } = await supabase.from('allocations').select('asset_id').eq('holder_id', profile.id).eq('status', 'ACTIVE')
      const myAssetIds = allocs?.map(a => a.asset_id) || []
      if (myAssetIds.length > 0) {
        query = query.in('id', myAssetIds)
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000') 
      }
    } else if (scope === 'bookable') {
      query = query.eq('is_bookable', true)
    } else if (profile.role === 'DEPARTMENT_HEAD') {
      if (profile.department_id) {
        query = query.eq('current_department_id', profile.department_id)
      }
    } else if (scope === 'bookable') {
      query = query.eq('is_bookable', true)
    } else if (profile.role === 'EMPLOYEE') {
      query = query.eq('is_bookable', true)
    }

    const { data } = await query
    if (isMounted.current) {
      setAssets((data || []) as unknown as Asset[])
      setLoading(false)
    }
  }, [supabase, statusFilter, categoryFilter, scope, profile])

  useEffect(() => {
    fetchAssets()
    const fetchMeta = async () => {
      const [catRes, deptRes] = await Promise.all([
        supabase.from('asset_categories').select('*').eq('status', 'ACTIVE').order('name'),
        supabase.from('departments').select('*').eq('status', 'ACTIVE').order('name'),
      ])
      if (isMounted.current) {
        setCategories((catRes.data as AssetCategory[]) || [])
        setDepartments((deptRes.data as Department[]) || [])
      }
    }
    fetchMeta()
  }, [fetchAssets, supabase])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('register_asset', {
      p_name: formData.name.trim(),
      p_category_id: formData.category_id,
      p_serial_number: formData.serial_number.trim() || null,
      p_acquisition_date: formData.acquisition_date || null,
      p_acquisition_cost: formData.acquisition_cost ? parseFloat(formData.acquisition_cost) : null,
      p_condition: formData.condition,
      p_location: formData.location.trim() || null,
      p_is_bookable: formData.is_bookable,
      p_department_id: formData.department_id === 'NONE' ? null : formData.department_id,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setShowRegister(false)
      setFormData({
        name: '', category_id: '', serial_number: '', acquisition_date: '',
        acquisition_cost: '', condition: 'New', location: '', is_bookable: false,
        department_id: 'NONE',
      })
      fetchAssets()
    }
    setSaving(false)
  }

  const filtered = assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.asset_tag.toLowerCase().includes(search.toLowerCase()) ||
    (a.serial_number?.toLowerCase().includes(search.toLowerCase()))
  )

  const getBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      'AVAILABLE': 'bg-green-100 text-green-800 border-green-200', 
      'ALLOCATED': 'bg-blue-100 text-blue-800 border-blue-200',
      'RESERVED': 'bg-purple-100 text-purple-800 border-purple-200', 
      'UNDER_MAINTENANCE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'LOST': 'bg-red-100 text-red-800 border-red-200', 
      'RETIRED': 'bg-gray-100 text-gray-800 border-gray-200', 
      'DISPOSED': 'bg-gray-100 text-gray-800 border-gray-200',
    }
    return map[status] || 'bg-gray-100 text-gray-800 border-gray-200'
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
          <h2 className="text-3xl font-bold tracking-tight">Assets</h2>
          <p className="text-muted-foreground mt-2">Manage all registered company assets and resources.</p>
        </div>
        {isManager && (
          <Button onClick={() => setShowRegister(true)}>
            <Plus className="mr-2 h-4 w-4" /> Register Asset
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-muted/50 p-4 rounded-lg border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, tag, or serial number..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Register Modal */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Register New Asset</DialogTitle>
          </DialogHeader>
          
          {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Name *</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. MacBook Pro 14" />
              </div>
              
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category_id} onValueChange={v => setFormData({...formData, category_id: v})} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} placeholder="Optional" />
              </div>

              <div className="space-y-2">
                <Label>Acquisition Date</Label>
                <Input type="date" value={formData.acquisition_date} onChange={e => setFormData({...formData, acquisition_date: e.target.value})} />
              </div>

              <div className="space-y-2">
                <Label>Acquisition Cost</Label>
                <Input type="number" step="0.01" value={formData.acquisition_cost} onChange={e => setFormData({...formData, acquisition_cost: e.target.value})} placeholder="0.00" />
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={formData.condition} onValueChange={v => setFormData({...formData, condition: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Fair">Fair</SelectItem>
                    <SelectItem value="Poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Floor 3, Room 301" />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={formData.department_id} onValueChange={v => setFormData({...formData, department_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Department</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="is_bookable" 
                checked={formData.is_bookable} 
                onCheckedChange={checked => setFormData({...formData, is_bookable: !!checked})} 
              />
              <Label htmlFor="is_bookable" className="font-normal text-sm">
                Shared / Bookable Resource (Can be booked by employees)
              </Label>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowRegister(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Registering...' : 'Register Asset'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Bookable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {assets.length === 0 ? 'No assets registered yet.' : 'No assets match your search.'}
                  </TableCell>
                </TableRow>
              ) : filtered.map(asset => {
                const cat = asset.asset_categories as unknown as { name: string } | null
                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      <Link href={`/assets/${asset.id}`} className="hover:underline hover:text-primary">
                        {asset.asset_tag}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cat?.name || '—'}</TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", getBadgeClass(asset.status))}>
                        {asset.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{asset.condition || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{asset.location || '—'}</TableCell>
                    <TableCell>
                      {asset.is_bookable ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Yes</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">No</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {assets.length} assets
      </p>
    </div>
  )
}
