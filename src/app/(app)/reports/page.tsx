'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { formatDistanceToNow, format, subMonths, isBefore, parseISO, getDay, getHours } from 'date-fns'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid 
} from 'recharts'

interface DeptUtilization {
  name: string
  count: number
}

interface MaintFreq {
  month: string
  count: number
}

interface AssetUsage {
  id: string
  name: string
  tag: string
  uses: number
}

interface IdleAsset {
  id: string
  name: string
  tag: string
  unusedFor: string
}

interface MaintenanceAsset {
  id: string
  name: string
  tag: string
  reason: string
}

interface HeatmapCell {
  day: number
  hour: number
  count: number
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [utilization, setUtilization] = useState<DeptUtilization[]>([])
  const [maintFreq, setMaintFreq] = useState<MaintFreq[]>([])
  const [mostUsed, setMostUsed] = useState<AssetUsage[]>([])
  const [idleAssets, setIdleAssets] = useState<IdleAsset[]>([])
  const [maintAssets, setMaintAssets] = useState<MaintenanceAsset[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [maxHeat, setMaxHeat] = useState(1)
  
  const supabase = createClient()

  useEffect(() => {
    const fetchReports = async () => {
      // 1. Utilization by department
      const { data: allocated } = await supabase
        .from('assets')
        .select('departments(name)')
        .eq('status', 'ALLOCATED')
      
      const deptMap: Record<string, number> = {}
      allocated?.forEach(a => {
        const dName = (a.departments as any)?.name || 'Unassigned'
        deptMap[dName] = (deptMap[dName] || 0) + 1
      })
      setUtilization(Object.keys(deptMap).map(k => ({ name: k, count: deptMap[k] })))

      // 2. Maintenance Frequency (last 6 months)
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString()
      const { data: maintReqs } = await supabase
        .from('maintenance_requests')
        .select('created_at')
        .gte('created_at', sixMonthsAgo)
      
      const monthMap: Record<string, number> = {}
      // Initialize last 6 months to 0
      for (let i = 5; i >= 0; i--) {
        monthMap[format(subMonths(new Date(), i), 'MMM yyyy')] = 0
      }
      maintReqs?.forEach(m => {
        const mth = format(new Date(m.created_at), 'MMM yyyy')
        if (monthMap[mth] !== undefined) monthMap[mth]++
      })
      setMaintFreq(Object.keys(monthMap).map(k => ({ month: k, count: monthMap[k] })))

      // 3. Most used assets (approximated by joining allocations and bookings count)
      // Supabase JS doesn't easily do a sum of relations without an RPC, so we fetch all and sort locally. 
      // For a real huge DB, we'd use an RPC.
      const { data: allAssets } = await supabase
        .from('assets')
        .select('id, name, asset_tag, allocations(id), bookings(id)')
      
      const usage = allAssets?.map(a => ({
        id: a.id,
        name: a.name,
        tag: a.asset_tag,
        uses: (a.allocations?.length || 0) + (a.bookings?.length || 0)
      })).sort((a, b) => b.uses - a.uses).slice(0, 5) || []
      setMostUsed(usage)

      // 4. Idle assets
      const { data: idle } = await supabase
        .from('assets')
        .select('id, name, asset_tag, updated_at')
        .eq('status', 'AVAILABLE')
        .order('updated_at', { ascending: true })
        .limit(5)
      
      setIdleAssets(idle?.map(a => ({
        id: a.id,
        name: a.name,
        tag: a.asset_tag,
        unusedFor: formatDistanceToNow(new Date(a.updated_at))
      })) || [])

      // 5. Assets due for maintenance / nearing retirement
      // We'll query UNDER_MAINTENANCE OR older than 3 years
      const threeYearsAgo = subMonths(new Date(), 36).toISOString()
      const { data: maintRetire } = await supabase
        .from('assets')
        .select('id, name, asset_tag, status, acquisition_date')
        .or(`status.eq.UNDER_MAINTENANCE,acquisition_date.lte.${threeYearsAgo}`)
        .limit(10)
      
      setMaintAssets(maintRetire?.map(a => {
        let reason = ''
        if (a.status === 'UNDER_MAINTENANCE') reason = 'Under maintenance'
        else if (a.acquisition_date && isBefore(new Date(a.acquisition_date), new Date(threeYearsAgo))) {
          reason = 'Nearing retirement (' + formatDistanceToNow(new Date(a.acquisition_date)) + ' old)'
        }
        return { id: a.id, name: a.name, tag: a.asset_tag, reason }
      }) || [])

      // 6. Booking Heatmap
      const { data: bookings } = await supabase.from('bookings').select('start_at, end_at').eq('status', 'COMPLETED')
      const hm: Record<string, number> = {}
      let maxC = 0
      bookings?.forEach(b => {
        const start = parseISO(b.start_at)
        const d = getDay(start) // 0-6 (Sun-Sat)
        const h = getHours(start)
        // map hour to one of our blocks: 8, 10, 12, 14, 16, 18
        const block = h < 10 ? 8 : h < 12 ? 10 : h < 14 ? 12 : h < 16 ? 14 : h < 18 ? 16 : 18
        const key = `${d}-${block}`
        hm[key] = (hm[key] || 0) + 1
        if (hm[key] > maxC) maxC = hm[key]
      })

      const heatCells: HeatmapCell[] = []
      for(let d = 0; d < 7; d++) {
        for(let h of [8, 10, 12, 14, 16, 18]) {
          heatCells.push({ day: d, hour: h, count: hm[`${d}-${h}`] || 0 })
        }
      }
      setHeatmap(heatCells)
      setMaxHeat(maxC || 1)

      setLoading(false)
    }
    fetchReports()
  }, [supabase])

  const exportCSV = () => {
    // Generate a simple combined CSV
    const rows = [
      ['Report Export', format(new Date(), 'yyyy-MM-dd HH:mm')],
      [],
      ['--- Utilization by Department ---'],
      ['Department', 'Count'],
      ...utilization.map(u => [u.name, u.count]),
      [],
      ['--- Most Used Assets ---'],
      ['Asset Tag', 'Name', 'Uses'],
      ...mostUsed.map(m => [m.tag, m.name, m.uses]),
      [],
      ['--- Idle Assets ---'],
      ['Asset Tag', 'Name', 'Unused For'],
      ...idleAssets.map(i => [i.tag, i.name, i.unusedFor])
    ]
    
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'AssetFlow_Report.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Utilization Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Utilization by department</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {utilization.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilization}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={true} />
                  <Tooltip 
                    cursor={{fill: 'var(--bg-muted)', opacity: 0.2}} 
                    contentStyle={{ backgroundColor: 'var(--bg-popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Maintenance Frequency</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {maintFreq.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={maintFreq}>
                  <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={true} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium text-muted-foreground">Resource Booking Peak Windows</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[100px_repeat(6,_1fr)] gap-2 mb-2 text-center text-sm font-medium text-muted-foreground">
                <div></div>
                <div>8:00 AM</div>
                <div>10:00 AM</div>
                <div>12:00 PM</div>
                <div>2:00 PM</div>
                <div>4:00 PM</div>
                <div>6:00 PM+</div>
              </div>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, d) => (
                <div key={d} className="grid grid-cols-[100px_repeat(6,_1fr)] gap-2 mb-2 items-center">
                  <div className="text-sm font-medium text-muted-foreground">{dayName}</div>
                  {[8, 10, 12, 14, 16, 18].map(h => {
                    const cell = heatmap.find(c => c.day === d && c.hour === h)
                    const count = cell ? cell.count : 0
                    const opacity = count === 0 ? 0.05 : Math.max(0.1, count / maxHeat)
                    return (
                      <div 
                        key={h} 
                        className="h-10 rounded-md transition-all duration-200 flex items-center justify-center text-xs font-semibold"
                        style={{ backgroundColor: `hsla(var(--primary), ${opacity})`, color: count > (maxHeat/2) ? '#fff' : 'inherit' }}
                        title={`${count} bookings`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Most Used Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Most used assets</CardTitle>
          </CardHeader>
          <CardContent>
            {mostUsed.length > 0 ? (
              <ul className="space-y-3">
                {mostUsed.map(m => (
                  <li key={m.id} className="text-sm text-muted-foreground flex justify-between">
                    <span><span className="font-medium text-foreground">{m.name}</span> {m.tag}</span>
                    <span>{m.uses} uses</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No assets found</p>
            )}
          </CardContent>
        </Card>

        {/* Idle Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium text-muted-foreground">Idle assets</CardTitle>
          </CardHeader>
          <CardContent>
            {idleAssets.length > 0 ? (
              <ul className="space-y-3">
                {idleAssets.map(i => (
                  <li key={i.id} className="text-sm text-muted-foreground flex justify-between">
                    <span><span className="font-medium text-foreground">{i.name}</span> {i.tag}</span>
                    <span>unused {i.unusedFor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No idle assets</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assets due for maintenance / nearing retirement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium text-muted-foreground">Assets due for maintenance / nearing retirement</CardTitle>
        </CardHeader>
        <CardContent>
          {maintAssets.length > 0 ? (
            <ul className="space-y-3">
              {maintAssets.map(ma => (
                <li key={ma.id} className="text-sm text-muted-foreground flex justify-between max-w-xl">
                  <span><span className="font-medium text-foreground">{ma.name}</span> {ma.tag}</span>
                  <span>{ma.reason}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No assets nearing retirement or due for maintenance.</p>
          )}
        </CardContent>
      </Card>
      
    </div>
  )
}
