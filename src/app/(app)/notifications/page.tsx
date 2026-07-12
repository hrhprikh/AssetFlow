'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifications((data as Notification[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchNotifications()

    const channel = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifications, supabase])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    fetchNotifications()
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
    fetchNotifications()
  }

  const navigateTo = (n: Notification) => {
    markAsRead(n.id)
    if (n.entity_type && n.entity_id) {
      const routes: Record<string, string> = {
        'ASSET': '/assets/',
        'BOOKING': '/bookings',
        'MAINTENANCE': '/maintenance',
        'AUDIT': '/audits',
        'TRANSFER': '/transfers',
      }
      const base = routes[n.entity_type] || '/dashboard'
      router.push(n.entity_type === 'ASSET' ? `${base}${n.entity_id}` : base)
    }
  }

  const getIcon = (type: string) => {
    if (type.includes('ASSIGNED') || type.includes('ALLOCATED')) return '🔗'
    if (type.includes('TRANSFER')) return '🔄'
    if (type.includes('BOOKING')) return '📅'
    if (type.includes('MAINTENANCE')) return '🔧'
    if (type.includes('AUDIT')) return '📋'
    if (type.includes('OVERDUE')) return '⚠'
    return '🔔'
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} /></div>

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)' }}>
        <p className="text-secondary text-sm">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        {unreadCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all as read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <h3 className="empty-state-title">No notifications</h3>
          <p className="empty-state-text">You&apos;re all caught up! Notifications will appear here when there are updates.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
          {notifications.map(n => (
            <div
              key={n.id}
              className="card card-hover"
              onClick={() => navigateTo(n)}
              style={{
                cursor: 'pointer',
                padding: 'var(--space-md)',
                opacity: n.read_at ? 0.6 : 1,
                borderLeft: n.read_at ? 'none' : '3px solid var(--color-primary)',
              }}
            >
              <div className="flex items-center gap-md">
                <span style={{ fontSize: '20px' }}>{getIcon(n.type)}</span>
                <div style={{ flex: 1 }}>
                  <div className="font-medium text-sm">{n.title}</div>
                  {n.body && <div className="text-sm text-secondary" style={{ marginTop: '2px' }}>{n.body}</div>}
                </div>
                <div className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {!n.read_at && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
