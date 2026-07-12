'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Asset } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface BookingFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function BookingForm({ onSuccess, onCancel }: BookingFormProps) {
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([])
  const [formData, setFormData] = useState({ asset_id: '', start_at: '', end_at: '', purpose: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchAssets = async () => {
      const { data } = await supabase.from('assets').select('id, name, asset_tag').eq('is_bookable', true).not('status', 'in', '("RETIRED","DISPOSED")').order('name')
      setBookableAssets((data || []) as Asset[])
    }
    fetchAssets()
  }, [supabase])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('create_booking', {
      p_asset_id: formData.asset_id,
      p_start_at: new Date(formData.start_at).toISOString(),
      p_end_at: new Date(formData.end_at).toISOString(),
      p_purpose: formData.purpose || null,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setFormData({ asset_id: '', start_at: '', end_at: '', purpose: '' })
      if (onSuccess) onSuccess()
    }
    setSaving(false)
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value
    setFormData(prev => {
      const newEnd = (prev.end_at && prev.end_at < newStart) ? newStart : prev.end_at
      return { ...prev, start_at: newStart, end_at: newEnd }
    })
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Resource *</Label>
          <Select value={formData.asset_id} onValueChange={v => setFormData({...formData, asset_id: v})} required>
            <SelectTrigger>
              <SelectValue placeholder="Select resource" />
            </SelectTrigger>
            <SelectContent>
              {bookableAssets.map(a => <SelectItem key={a.id} value={a.id}>{a.asset_tag} — {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Start *</Label>
          <Input type="datetime-local" min={new Date().toISOString().slice(0,16)} value={formData.start_at} onChange={handleStartDateChange} required />
        </div>
        
        <div className="space-y-2">
          <Label>End *</Label>
          <Input type="datetime-local" min={formData.start_at || new Date().toISOString().slice(0,16)} value={formData.end_at} onChange={e => setFormData({...formData, end_at: e.target.value})} required />
        </div>
        
        <div className="space-y-2">
          <Label>Purpose</Label>
          <Input value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} placeholder="e.g. Team standup" />
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={saving}>{saving ? 'Booking...' : 'Create Booking'}</Button>
      </div>
    </form>
  )
}
