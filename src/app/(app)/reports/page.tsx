'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ReportsPage() {
  const [reportData, setReportData] = useState<{
    byStatus: { status: string; count: number }[]
    byCategory: { name: string; count: number }[]
    byDepartment: { name: string; count: number }[]
    maintenanceFreq: { name: string; count: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchReports = async () => {
      // Assets by status
      const { data: assets } = await supabase.from('assets').select('status')
      const byStatus: Record<string, number> = {}
      assets?.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1 })

      // Assets by category
      const { data: catAssets } = await supabase.from('assets').select('asset_categories(name)')
      const byCategory: Record<string, number> = {}
      catAssets?.forEach(a => { const name = (a.asset_categories as unknown as { name: string })?.name || 'Unknown'; byCategory[name] = (byCategory[name] || 0) + 1 })

      // Assets by department
      const { data: deptAssets } = await supabase.from('assets').select('departments(name)')
      const byDept: Record<string, number> = {}
      deptAssets?.forEach(a => { const name = (a.departments as unknown as { name: string })?.name || 'Unassigned'; byDept[name] = (byDept[name] || 0) + 1 })

      // Maintenance frequency
      const { data: maintReqs } = await supabase.from('maintenance_requests').select('assets(name)')
      const maintFreq: Record<string, number> = {}
      maintReqs?.forEach(m => { const name = (m.assets as unknown as { name: string })?.name || 'Unknown'; maintFreq[name] = (maintFreq[name] || 0) + 1 })

      setReportData({
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
        byCategory: Object.entries(byCategory).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        byDepartment: Object.entries(byDept).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        maintenanceFreq: Object.entries(maintFreq).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      })
      setLoading(false)
    }
    fetchReports()
  }, [supabase])

  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const maxVal = (arr: { count: number }[]) => Math.max(...arr.map(a => a.count), 1)

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>
  if (!reportData) return null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 'var(--space-lg)' }}>
        {/* Assets by Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Assets by Status</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(reportData.byStatus, 'assets_by_status.csv')}>Export CSV</button>
          </div>
          {reportData.byStatus.map(item => (
            <div key={item.status} style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
                <span>{item.status.replace('_', ' ')}</span>
                <span className="font-medium">{item.count}</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(item.count / maxVal(reportData.byStatus)) * 100}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Assets by Category */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Assets by Category</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(reportData.byCategory, 'assets_by_category.csv')}>Export CSV</button>
          </div>
          {reportData.byCategory.map(item => (
            <div key={item.name} style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
                <span>{item.name}</span>
                <span className="font-medium">{item.count}</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(item.count / maxVal(reportData.byCategory)) * 100}%`, background: 'linear-gradient(90deg, var(--color-accent), var(--color-success))', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
          {reportData.byCategory.length === 0 && <p className="text-sm text-muted">No data yet</p>}
        </div>

        {/* Assets by Department */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Assets by Department</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(reportData.byDepartment, 'assets_by_department.csv')}>Export CSV</button>
          </div>
          {reportData.byDepartment.map(item => (
            <div key={item.name} style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
                <span>{item.name}</span>
                <span className="font-medium">{item.count}</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(item.count / maxVal(reportData.byDepartment)) * 100}%`, background: 'linear-gradient(90deg, var(--color-warning), #f97316)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
          {reportData.byDepartment.length === 0 && <p className="text-sm text-muted">No data yet</p>}
        </div>

        {/* Maintenance Frequency */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Maintenance Frequency (Top 10)</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(reportData.maintenanceFreq, 'maintenance_frequency.csv')}>Export CSV</button>
          </div>
          {reportData.maintenanceFreq.map(item => (
            <div key={item.name} style={{ marginBottom: 'var(--space-sm)' }}>
              <div className="flex justify-between text-sm" style={{ marginBottom: '4px' }}>
                <span className="truncate" style={{ maxWidth: '250px' }}>{item.name}</span>
                <span className="font-medium">{item.count}</span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(item.count / maxVal(reportData.maintenanceFreq)) * 100}%`, background: 'linear-gradient(90deg, var(--color-danger), #f97316)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
          {reportData.maintenanceFreq.length === 0 && <p className="text-sm text-muted">No data yet</p>}
        </div>
      </div>
    </div>
  )
}
