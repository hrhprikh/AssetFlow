'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '../layout'
import { useSearchParams } from 'next/navigation'
import type { Asset, AssetCategory, Department } from '@/lib/types'
import Link from 'next/link'

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
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '', category_id: '', serial_number: '', acquisition_date: '',
    acquisition_cost: '', condition: 'New', location: '', is_bookable: false,
    department_id: '',
  })
  const supabase = createClient()
  const isManager = profile?.role === 'ADMIN' || profile?.role === 'ASSET_MANAGER'

  const fetchAssets = useCallback(async () => {
    if (!profile) return

    let query = supabase
      .from('assets')
      .select('*, asset_categories(name), departments(name)')
      .order('created_at', { ascending: false })

    if (statusFilter !== 'ALL') query = query.eq('status', statusFilter)
    if (categoryFilter) query = query.eq('category_id', categoryFilter)

    if (scope === 'mine') {
      // We need to fetch allocations first, or we can just fetch all and filter in JS if it's small, 
      // but it's better to fetch assets where they have an active allocation.
      // Since Supabase JS doesn't support deep inner joins for filtering top-level easily without changing the return type, 
      // let's fetch my allocation asset IDs first.
      const { data: allocs } = await supabase.from('allocations').select('asset_id').eq('holder_id', profile.id).eq('status', 'ACTIVE')
      const myAssetIds = allocs?.map(a => a.asset_id) || []
      if (myAssetIds.length > 0) {
        query = query.in('id', myAssetIds)
      } else {
        // Force empty result if they have no assets
        query = query.eq('id', '00000000-0000-0000-0000-000000000000') 
      }
    } else if (scope === 'bookable') {
      query = query.eq('is_bookable', true)
    } else if (profile.role === 'DEPARTMENT_HEAD') {
      // Dept head sees their dept assets by default if no scope is provided
      query = query.eq('current_department_id', profile.department_id)
    } else if (profile.role === 'EMPLOYEE') {
      // Employee sees bookable resources by default if no scope is provided (so they can book them)
      query = query.eq('is_bookable', true)
    }

    const { data } = await query
    setAssets((data || []) as unknown as Asset[])
    setLoading(false)
  }, [supabase, statusFilter, categoryFilter, scope, profile])

  useEffect(() => {
    fetchAssets()
    const fetchMeta = async () => {
      const [catRes, deptRes] = await Promise.all([
        supabase.from('asset_categories').select('*').eq('status', 'ACTIVE').order('name'),
        supabase.from('departments').select('*').eq('status', 'ACTIVE').order('name'),
      ])
      setCategories((catRes.data as AssetCategory[]) || [])
      setDepartments((deptRes.data as Department[]) || [])
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
      p_department_id: formData.department_id || null,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setShowRegister(false)
      setFormData({
        name: '', category_id: '', serial_number: '', acquisition_date: '',
        acquisition_cost: '', condition: 'New', location: '', is_bookable: false,
        department_id: '',
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
      'AVAILABLE': 'badge-available', 'ALLOCATED': 'badge-allocated',
      'RESERVED': 'badge-reserved', 'UNDER_MAINTENANCE': 'badge-under-maintenance',
      'LOST': 'badge-lost', 'RETIRED': 'badge-retired', 'DISPOSED': 'badge-disposed',
    }
    return map[status] || 'badge-active'
  }

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search by name, tag, or serial number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace('_', ' ')}</option>
          ))}
        </select>
        <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {isManager && (
          <button className="btn btn-primary" onClick={() => setShowRegister(!showRegister)}>
            + Register Asset
          </button>
        )}
      </div>

      {/* Register Form */}
      {showRegister && isManager && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Register New Asset</h3>
          {error && <div className="alert-banner alert-error" style={{ marginBottom: 'var(--space-md)' }}>⚠ {error}</div>}
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Asset Name *</label>
                <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. MacBook Pro 14" />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} required>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Serial Number</label>
                <input className="form-input" value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Acquisition Date</label>
                <input className="form-input" type="date" value={formData.acquisition_date} onChange={e => setFormData({...formData, acquisition_date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Acquisition Cost</label>
                <input className="form-input" type="number" step="0.01" value={formData.acquisition_cost} onChange={e => setFormData({...formData, acquisition_cost: e.target.value})} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Condition</label>
                <select className="form-select" value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})}>
                  <option value="New">New</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Floor 3, Room 301" />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={formData.department_id} onChange={e => setFormData({...formData, department_id: e.target.value})}>
                  <option value="">No Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <label className="form-checkbox-group">
                  <input type="checkbox" className="form-checkbox" checked={formData.is_bookable} onChange={e => setFormData({...formData, is_bookable: e.target.checked})} />
                  <span className="text-sm">Shared / Bookable Resource</span>
                </label>
              </div>
            </div>
            <div className="flex gap-sm" style={{ marginTop: 'var(--space-lg)' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Registering...' : 'Register Asset'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowRegister(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Assets Table */}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Condition</th>
              <th>Location</th>
              <th>Bookable</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="data-table-empty">
                {assets.length === 0 ? 'No assets registered yet. Click "Register Asset" to add one.' : 'No assets match your search.'}
              </td></tr>
            ) : filtered.map(asset => {
              const cat = asset.asset_categories as unknown as { name: string } | null
              return (
                <tr key={asset.id}>
                  <td>
                    <Link href={`/assets/${asset.id}`} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}>
                      {asset.asset_tag}
                    </Link>
                  </td>
                  <td className="font-medium">{asset.name}</td>
                  <td className="text-sm text-secondary">{cat?.name || '—'}</td>
                  <td><span className={`badge ${getBadgeClass(asset.status)}`}>{asset.status.replace('_', ' ')}</span></td>
                  <td className="text-sm">{asset.condition || '—'}</td>
                  <td className="text-sm text-secondary">{asset.location || '—'}</td>
                  <td>{asset.is_bookable ? <span className="badge badge-active">Yes</span> : <span className="text-muted text-sm">No</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted" style={{ marginTop: 'var(--space-md)' }}>
        Showing {filtered.length} of {assets.length} assets
      </p>
    </div>
  )
}
