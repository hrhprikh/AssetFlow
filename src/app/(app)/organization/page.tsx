'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import type { Department, AssetCategory, Profile, UserRole } from '@/lib/types'

type OrgTab = 'departments' | 'categories' | 'employees'

export default function OrganizationPage() {
  const { profile } = useApp()
  const [activeTab, setActiveTab] = useState<OrgTab>('departments')
  const isAdmin = profile?.role === 'ADMIN'

  return (
    <div>
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          🏢 Departments
        </button>
        <button
          className={`tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          📁 Categories
        </button>
        <button
          className={`tab ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          👥 Employee Directory
        </button>
      </div>

      {activeTab === 'departments' && <DepartmentsTab isAdmin={isAdmin} />}
      {activeTab === 'categories' && <CategoriesTab isAdmin={isAdmin} />}
      {activeTab === 'employees' && <EmployeesTab isAdmin={isAdmin} />}
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
  const [formData, setFormData] = useState({ name: '', code: '', parent_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const fetchDepartments = useCallback(async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .order('name')
    setDepartments((data as Department[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchDepartments() }, [fetchDepartments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      parent_id: formData.parent_id || null,
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
      setFormData({ name: '', code: '', parent_id: '' })
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
    setFormData({ name: dept.name, code: dept.code, parent_id: dept.parent_id || '' })
    setShowForm(true)
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingDept(null); setFormData({ name: '', code: '', parent_id: '' }) }}>
            + Add Department
          </button>
        </div>
      )}

      {showForm && isAdmin && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            {editingDept ? 'Edit Department' : 'New Department'}
          </h3>
          {error && <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠ {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label">Name</label>
                <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Engineering" />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                <label className="form-label">Code</label>
                <input className="form-input" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required placeholder="e.g. ENG" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label">Parent Department</label>
                <select className="form-select" value={formData.parent_id} onChange={e => setFormData({...formData, parent_id: e.target.value})}>
                  <option value="">None (Top-level)</option>
                  {departments.filter(d => d.id !== editingDept?.id).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (editingDept ? 'Update' : 'Create')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingDept(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Parent</th>
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr><td colSpan={isAdmin ? 5 : 4} className="data-table-empty">No departments yet</td></tr>
            ) : departments.map(dept => (
              <tr key={dept.id}>
                <td className="font-medium">{dept.name}</td>
                <td><code style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{dept.code}</code></td>
                <td className="text-sm text-secondary">{departments.find(d => d.id === dept.parent_id)?.name || '—'}</td>
                <td><span className={`badge ${dept.status === 'ACTIVE' ? 'badge-active' : 'badge-retired'}`}>{dept.status}</span></td>
                {isAdmin && (
                  <td>
                    <div className="flex gap-xs">
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(dept)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(dept)}>
                        {dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('asset_categories').select('*').order('name')
    setCategories((data as AssetCategory[]) || [])
    setLoading(false)
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

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingCat(null); setFormData({ name: '', description: '' }) }}>
            + Add Category
          </button>
        </div>
      )}

      {showForm && isAdmin && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
            {editingCat ? 'Edit Category' : 'New Category'}
          </h3>
          {error && <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠ {error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label">Name</label>
                <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. Laptops" />
              </div>
              <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
                <label className="form-label">Description</label>
                <input className="form-input" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Optional description" />
              </div>
            </div>
            <div className="flex gap-sm" style={{ marginTop: 'var(--space-md)' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (editingCat ? 'Update' : 'Create')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr><td colSpan={isAdmin ? 4 : 3} className="data-table-empty">No categories yet</td></tr>
            ) : categories.map(cat => (
              <tr key={cat.id}>
                <td className="font-medium">{cat.name}</td>
                <td className="text-sm text-secondary">{cat.description || '—'}</td>
                <td><span className={`badge ${cat.status === 'ACTIVE' ? 'badge-active' : 'badge-retired'}`}>{cat.status}</span></td>
                {isAdmin && (
                  <td>
                    <div className="flex gap-xs">
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingCat(cat); setFormData({ name: cat.name, description: cat.description || '' }); setShowForm(true) }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(cat)}>
                        {cat.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================
// Employee Directory Tab
// ============================================================
function EmployeesTab({ isAdmin }: { isAdmin: boolean }) {
  const [employees, setEmployees] = useState<(Profile & { departments?: { name: string } | null })[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleModal, setRoleModal] = useState<{ user: Profile; newRole: UserRole } | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, departments(name)')
      .order('name')
    setEmployees(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchEmployees()
    const fetchDepts = async () => {
      const { data } = await supabase.from('departments').select('*').eq('status', 'ACTIVE').order('name')
      setDepartments((data as Department[]) || [])
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

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setRoleModal(null)
      fetchEmployees()
    }
    setSaving(false)
  }

  const handleDeptAssign = async (userId: string, deptId: string) => {
    await supabase.from('profiles').update({ department_id: deptId || null }).eq('id', userId)
    fetchEmployees()
  }

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  )

  const roles: UserRole[] = ['ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE']

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      <div className="filter-bar">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search employees..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Role</th>
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={isAdmin ? 6 : 5} className="data-table-empty">No employees found</td></tr>
            ) : filtered.map(emp => (
              <tr key={emp.id}>
                <td className="font-medium">{emp.name}</td>
                <td className="text-sm text-secondary">{emp.email}</td>
                <td>
                  {isAdmin ? (
                    <select
                      className="form-select"
                      value={emp.department_id || ''}
                      onChange={e => handleDeptAssign(emp.id, e.target.value)}
                      style={{ padding: '6px 30px 6px 10px', fontSize: '13px', minWidth: '140px' }}
                    >
                      <option value="">No Department</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm">{emp.departments?.name || '—'}</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${
                    emp.role === 'ADMIN' ? 'badge-danger' :
                    emp.role === 'ASSET_MANAGER' ? 'badge-allocated' :
                    emp.role === 'DEPARTMENT_HEAD' ? 'badge-under-maintenance' :
                    emp.role === 'AUDITOR' ? 'badge-reserved' :
                    'badge-active'
                  }`}>
                    {emp.role.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <span className={`badge ${emp.status === 'ACTIVE' ? 'badge-active' : 'badge-retired'}`}>
                    {emp.status}
                  </span>
                </td>
                {isAdmin && (
                  <td>
                    {emp.id === profile?.id ? (
                      <span className="text-sm text-muted">Current User</span>
                    ) : (
                      <select
                        className="form-select"
                        value={emp.role}
                        onChange={e => setRoleModal({ user: emp, newRole: e.target.value as UserRole })}
                        style={{ padding: '6px 30px 6px 10px', fontSize: '13px', minWidth: '160px' }}
                      >
                        <option value={emp.role} disabled>{emp.role.replace('_', ' ')}</option>
                        {roles.filter(r => r !== emp.role).map(r => (
                          <option key={r} value={r}>{r.replace('_', ' ')}</option>
                        ))}
                      </select>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Change Confirmation Modal */}
      {roleModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Confirm Role Change</h3>
              <button className="modal-close" onClick={() => setRoleModal(null)}>✕</button>
            </div>
            <p style={{ marginBottom: 'var(--space-md)' }}>
              Change <strong>{roleModal.user.name}</strong>&apos;s role from{' '}
              <span className="badge badge-reserved">{roleModal.user.role.replace('_', ' ')}</span>
              {' '}to{' '}
              <span className="badge badge-allocated">{roleModal.newRole.replace('_', ' ')}</span>?
            </p>
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-lg)' }}>
              This action will be logged in the activity log.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRoleModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRoleChange} disabled={saving}>
                {saving ? 'Saving...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
