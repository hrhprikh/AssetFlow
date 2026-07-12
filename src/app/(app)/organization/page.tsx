'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { Department, AssetCategory, Profile, UserRole } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Building2, FolderTree, Users, Plus, Search, Edit2, Power, PowerOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type OrgTab = 'departments' | 'categories' | 'employees'

export default function OrganizationPage() {
  const { profile } = useApp()
  const [activeTab, setActiveTab] = useState<OrgTab>('departments')
  const isAdmin = profile?.role === 'ADMIN'

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Organization Settings</h2>
        <p className="text-muted-foreground mt-2">Manage departments, asset categories, and the employee directory.</p>
      </div>

      <div className="flex space-x-1 rounded-xl bg-muted/50 p-1 w-fit">
        <button
          className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", activeTab === 'departments' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50")}
          onClick={() => setActiveTab('departments')}
        >
          <Building2 className="h-4 w-4" /> Departments
        </button>
        <button
          className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", activeTab === 'categories' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50")}
          onClick={() => setActiveTab('categories')}
        >
          <FolderTree className="h-4 w-4" /> Categories
        </button>
        <button
          className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", activeTab === 'employees' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50")}
          onClick={() => setActiveTab('employees')}
        >
          <Users className="h-4 w-4" /> Employees
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'departments' && <DepartmentsTab isAdmin={isAdmin} />}
        {activeTab === 'categories' && <CategoriesTab isAdmin={isAdmin} />}
        {activeTab === 'employees' && <EmployeesTab isAdmin={isAdmin} />}
      </div>
    </div>
  )
}

// ============================================================
// Departments Tab
// ============================================================
function DepartmentsTab({ isAdmin }: { isAdmin: boolean }) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [formData, setFormData] = useState({ name: '', code: '', parent_id: 'NONE' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase.from('departments').select('*').order('name')
    if (isMounted.current) {
      setDepartments((data as Department[]) || [])
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { fetchDepartments() }, [fetchDepartments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      parent_id: formData.parent_id === 'NONE' ? null : formData.parent_id,
    }

    let result
    if (editingDept) {
      result = await supabase.from('departments').update(payload).eq('id', editingDept.id)
    } else {
      result = await supabase.from('departments').insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setShowForm(false)
      setEditingDept(null)
      setFormData({ name: '', code: '', parent_id: 'NONE' })
      fetchDepartments()
    }
    setSaving(false)
  }

  const toggleStatus = async (dept: Department) => {
    const newStatus = dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await supabase.from('departments').update({ status: newStatus }).eq('id', dept.id)
    fetchDepartments()
  }

  const startEdit = (dept: Department) => {
    setEditingDept(dept)
    setFormData({ name: dept.name, code: dept.code, parent_id: dept.parent_id || 'NONE' })
    setShowForm(true)
  }

  if (loading) return <div className="py-12 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => { setShowForm(true); setEditingDept(null); setFormData({ name: '', code: '', parent_id: 'NONE' }) }}>
            <Plus className="mr-2 h-4 w-4" /> Add Department
          </Button>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Edit Department' : 'New Department'}</DialogTitle>
          </DialogHeader>
          {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Engineering" />
            </div>
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required placeholder="e.g. ENG" className="uppercase" />
            </div>
            <div className="space-y-2">
              <Label>Parent Department</Label>
              <Select value={formData.parent_id} onValueChange={v => setFormData({...formData, parent_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (Top-level)</SelectItem>
                  {departments.filter(d => d.id !== editingDept?.id).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (editingDept ? 'Update' : 'Create')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="h-24 text-center text-muted-foreground">No departments yet</TableCell>
                </TableRow>
              ) : departments.map(dept => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell><code className="rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{dept.code}</code></TableCell>
                  <TableCell className="text-muted-foreground">{departments.find(d => d.id === dept.parent_id)?.name || '—'}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", dept.status === 'ACTIVE' ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200")}>
                      {dept.status}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(dept)}>
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(dept)} title={dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                          {dept.status === 'ACTIVE' ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-green-600" />}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Categories Tab
// ============================================================
function CategoriesTab({ isAdmin }: { isAdmin: boolean }) {
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCat, setEditingCat] = useState<AssetCategory | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('asset_categories').select('*').order('name')
    if (isMounted.current) {
      setCategories((data as AssetCategory[]) || [])
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = { name: formData.name.trim(), description: formData.description.trim() || null }
    let result
    if (editingCat) {
      result = await supabase.from('asset_categories').update(payload).eq('id', editingCat.id)
    } else {
      result = await supabase.from('asset_categories').insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
    } else {
      setShowForm(false)
      setEditingCat(null)
      setFormData({ name: '', description: '' })
      fetchCategories()
    }
    setSaving(false)
  }

  const toggleStatus = async (cat: AssetCategory) => {
    const newStatus = cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await supabase.from('asset_categories').update({ status: newStatus }).eq('id', cat.id)
    fetchCategories()
  }

  const startEdit = (cat: AssetCategory) => {
    setEditingCat(cat)
    setFormData({ name: cat.name, description: cat.description || '' })
    setShowForm(true)
  }

  if (loading) return <div className="py-12 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => { setShowForm(true); setEditingCat(null); setFormData({ name: '', description: '' }) }}>
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Laptops" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional description" />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (editingCat ? 'Update' : 'Create')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} className="h-24 text-center text-muted-foreground">No categories yet</TableCell>
                </TableRow>
              ) : categories.map(cat => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground">{cat.description || '—'}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", cat.status === 'ACTIVE' ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200")}>
                      {cat.status}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(cat)}>
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(cat)} title={cat.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                          {cat.status === 'ACTIVE' ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-green-600" />}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// Employee Directory Tab
// ============================================================
function EmployeesTab({ isAdmin }: { isAdmin: boolean }) {
  const { profile } = useApp()
  const [employees, setEmployees] = useState<(Profile & { departments?: { name: string } | null })[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleModal, setRoleModal] = useState<{ user: Profile; newRole: UserRole } | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const isMounted = useRef(true)
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments!profiles_department_id_fkey(name)')
      .order('name')
    if (error) console.error('Error fetching employees:', error)
    if (isMounted.current) {
      setEmployees((data as any) || [])
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchEmployees()
    const fetchDepts = async () => {
      const { data } = await supabase.from('departments').select('*').eq('status', 'ACTIVE').order('name')
      if (isMounted.current) {
        setDepartments((data as Department[]) || [])
      }
    }
    fetchDepts()
  }, [fetchEmployees, supabase])

  const handleRoleChange = async () => {
    if (!roleModal) return
    setSaving(true)

    const { error } = await supabase.rpc('promote_user', {
      target_user_id: roleModal.user.id,
      new_role: roleModal.newRole,
    })

    if (error) alert('Error: ' + error.message)
    else {
      setRoleModal(null)
      fetchEmployees()
    }
    setSaving(false)
  }

  const handleDeptAssign = async (userId: string, deptId: string) => {
    await supabase.from('profiles').update({ department_id: deptId === 'NONE' ? null : deptId }).eq('id', userId)
    fetchEmployees()
  }

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  )

  const roles: UserRole[] = ['ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE', 'ADMIN']

  if (loading) return <div className="py-12 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex bg-muted/50 p-2 rounded-lg border w-full max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search employees..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No employees found</TableCell>
                </TableRow>
              ) : filtered.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="text-muted-foreground">{emp.email}</TableCell>

                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", 
                      emp.role === 'ADMIN' ? 'bg-red-100 text-red-800 border-red-200' :
                      emp.role === 'ASSET_MANAGER' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      emp.role === 'DEPARTMENT_HEAD' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-green-100 text-green-800 border-green-200'
                    )}>
                      {emp.role.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", emp.status === 'ACTIVE' ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200")}>
                      {emp.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {emp.id === profile?.id ? (
                      <span className="text-xs text-muted-foreground mr-4">Current User</span>
                    ) : (
                      <Select value={emp.role} onValueChange={v => setRoleModal({ user: emp, newRole: v as UserRole })}>
                        <SelectTrigger className="w-[160px] h-8 text-xs ml-auto">
                          <SelectValue placeholder="Change Role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(r => (
                            <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!roleModal} onOpenChange={open => !open && setRoleModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change {roleModal?.user.name}&apos;s role? This action will be logged in the activity log.
            </DialogDescription>
          </DialogHeader>
          {roleModal && (
            <div className="py-4">
              <p>
                Change <strong>{roleModal.user.name}</strong> from{' '}
                <span className="font-semibold text-primary">{roleModal.user.role.replace('_', ' ')}</span>
                {' '}to{' '}
                <span className="font-semibold text-primary">{roleModal.newRole.replace('_', ' ')}</span>?
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleModal(null)}>Cancel</Button>
            <Button onClick={handleRoleChange} disabled={saving}>{saving ? 'Saving...' : 'Confirm Change'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
