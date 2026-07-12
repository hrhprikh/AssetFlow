'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Asset } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface MaintenanceFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function MaintenanceForm({ onSuccess, onCancel }: MaintenanceFormProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [formData, setFormData] = useState({ asset_id: '', issue: '', priority: 'MEDIUM' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchAssets = async () => {
      const { data } = await supabase.from('assets').select('id, name, asset_tag').not('status', 'in', '("DISPOSED")').order('name')
      setAssets((data || []) as Asset[])
    }
    fetchAssets()
  }, [supabase])

  const handleRaise = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('raise_maintenance', {
      p_asset_id: formData.asset_id,
      p_issue: formData.issue,
      p_priority: formData.priority,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setFormData({ asset_id: '', issue: '', priority: 'MEDIUM' })
      if (onSuccess) onSuccess()
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleRaise} className="space-y-4">
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Asset *</Label>
          <Select value={formData.asset_id} onValueChange={v => setFormData({...formData, asset_id: v})} required>
            <SelectTrigger>
              <SelectValue placeholder="Select asset" />
            </SelectTrigger>
            <SelectContent>
              {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.asset_tag} — {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority *</Label>
          <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v})} required>
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Issue Details *</Label>
        <Textarea 
          value={formData.issue} 
          onChange={e => setFormData({...formData, issue: e.target.value})} 
          placeholder="Describe the problem..." 
          required 
          className="min-h-[100px]"
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</Button>
      </div>
    </form>
  )
}
