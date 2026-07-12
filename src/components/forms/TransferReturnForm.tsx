'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Asset, Profile, Allocation } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface TransferReturnFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function TransferReturnForm({ onSuccess, onCancel }: TransferReturnFormProps) {
  const [actionType, setActionType] = useState<'TRANSFER' | 'RETURN'>('TRANSFER')
  const [myAssets, setMyAssets] = useState<(Allocation & { assets: Asset })[]>([])
  const [employees, setEmployees] = useState<Profile[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState('')
  
  // Transfer state
  const [transferTargetId, setTransferTargetId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  
  // Return state
  const [returnCondition, setReturnCondition] = useState('Good')
  const [returnNotes, setReturnNotes] = useState('')
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [allocsRes, empRes] = await Promise.all([
        supabase.from('allocations').select('*, assets(*)').eq('holder_id', user.id).eq('status', 'ACTIVE'),
        supabase.from('profiles').select('id, name, email').eq('status', 'ACTIVE').order('name')
      ])

      if (allocsRes.data) setMyAssets(allocsRes.data as unknown as (Allocation & { assets: Asset })[])
      if (empRes.data) setEmployees(empRes.data as Profile[])
    }
    fetchData()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (actionType === 'TRANSFER') {
      const { error: rpcError } = await supabase.rpc('request_transfer', {
        p_asset_id: selectedAssetId,
        p_target_holder_type: 'EMPLOYEE',
        p_target_holder_id: transferTargetId,
        p_reason: transferReason || null
      })
      if (rpcError) setError(rpcError.message)
      else if (onSuccess) onSuccess()
    } else {
      const { error: rpcError } = await supabase.rpc('return_asset', {
        p_asset_id: selectedAssetId,
        p_return_condition: returnCondition,
        p_return_notes: returnNotes || null
      })
      if (rpcError) setError(rpcError.message)
      else if (onSuccess) onSuccess()
    }

    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>}
      
      <div className="space-y-3">
        <Label>Action</Label>
        <div className="flex gap-2">
          <Button type="button" variant={actionType === 'TRANSFER' ? 'default' : 'outline'} onClick={() => setActionType('TRANSFER')} className="flex-1">
            Transfer Asset
          </Button>
          <Button type="button" variant={actionType === 'RETURN' ? 'default' : 'outline'} onClick={() => setActionType('RETURN')} className="flex-1">
            Return Asset
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Select Asset *</Label>
        <Select value={selectedAssetId} onValueChange={setSelectedAssetId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select one of your assets..." />
          </SelectTrigger>
          <SelectContent>
            {myAssets.map(item => (
              <SelectItem key={item.asset_id} value={item.asset_id}>
                {item.assets.asset_tag} — {item.assets.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {myAssets.length === 0 && <p className="text-xs text-muted-foreground mt-1">You have no active asset allocations.</p>}
      </div>

      {actionType === 'TRANSFER' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
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
        </div>
      )}

      {actionType === 'RETURN' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
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
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={saving || !selectedAssetId || myAssets.length === 0}>
          {saving ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </form>
  )
}
