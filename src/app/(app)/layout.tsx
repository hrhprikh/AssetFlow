'use client'

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'

// ---- Context ----
interface AppContextType {
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppContextType>({
  profile: null,
  loading: true,
  refreshProfile: async () => {},
})

export function useApp() {
  return useContext(AppContext)
}

// ---- Navigation Config ----
interface NavItem {
  label: string
  href: string
  icon: string
  roles?: string[]
}

const getNavSections = (role: string): { label: string; items: NavItem[] }[] => {
  switch (role) {
    case 'ADMIN':
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: '📊' },
          ],
        },
        {
          label: 'Management',
          items: [
            { label: 'Organization Setup', href: '/organization', icon: '🏢' },
            { label: 'Employee Directory', href: '/organization?tab=employees', icon: '👥' },
          ]
        },
        {
          label: 'Assets',
          items: [
            { label: 'Assets', href: '/assets', icon: '📦' },
            { label: 'Allocations', href: '/allocations', icon: '🔗' },
            { label: 'Bookings', href: '/bookings', icon: '📅' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Maintenance', href: '/maintenance', icon: '🔧' },
            { label: 'Audits', href: '/audits', icon: '📋' },
            { label: 'Reports', href: '/reports', icon: '📈' },
            { label: 'Activity Logs', href: '/logs', icon: '📝' },
          ],
        },
      ];
    case 'ASSET_MANAGER':
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: '📊' },
          ],
        },
        {
          label: 'Assets',
          items: [
            { label: 'Assets', href: '/assets', icon: '📦' },
            { label: 'Allocations', href: '/allocations', icon: '🔗' },
            { label: 'Transfers', href: '/transfers', icon: '🔄' },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Maintenance', href: '/maintenance', icon: '🔧' },
            { label: 'Audits', href: '/audits', icon: '📋' },
            { label: 'Reports', href: '/reports', icon: '📈' },
          ],
        },
      ];
    case 'DEPARTMENT_HEAD':
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: '📊' },
          ],
        },
        {
          label: 'Department',
          items: [
            { label: 'Department Assets', href: '/assets', icon: '📦' },
            { label: 'Transfers', href: '/transfers', icon: '🔄' },
            { label: 'Bookings', href: '/bookings', icon: '📅' },
            { label: 'Audits', href: '/audits', icon: '📋' },
          ],
        },
      ];
    default: // EMPLOYEE
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: '📊' },
            { label: 'Notifications', href: '/notifications', icon: '🔔' },
          ],
        },
        {
          label: 'Personal',
          items: [
            { label: 'My Assets', href: '/assets?scope=mine', icon: '📦' },
            { label: 'Book Resources', href: '/assets?scope=bookable', icon: '📅' },
            { label: 'My Bookings', href: '/bookings', icon: '📅' },
            { label: 'Maintenance Requests', href: '/maintenance', icon: '🔧' },
            { label: 'Profile', href: '/profile', icon: '👤' },
          ],
        },
      ];
  }
}

// ---- Layout Component ----
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data as Profile)
    }
    setLoading(false)
  }, [supabase, router])

  const fetchUnread = useCallback(async () => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null)

    setUnreadCount(count || 0)
  }, [supabase])

  useEffect(() => {
    fetchProfile()
    fetchUnread()

    // Realtime subscription for notifications
    const channel = supabase
      .channel('notifications-count')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, () => {
        fetchUnread()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchProfile, fetchUnread, supabase])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    // Route Protection
    if (!loading && profile) {
      const allowedSections = getNavSections(profile.role)
      const allowedHrefs = allowedSections.flatMap(s => s.items.map(i => i.href.split('?')[0]))
      
      // Allow base dashboard, and exact matches or sub-routes of allowed items
      // We strip query params from item.href just in case (e.g. /organization?tab=employees -> /organization)
      const isAllowed = allowedHrefs.some(href => 
        pathname === href || pathname.startsWith(href + '/')
      )

      if (!isAllowed) {
        console.warn(`Unauthorized access attempt to ${pathname} by role ${profile.role}`)
        router.push('/dashboard')
      }
    }
  }, [pathname, profile, loading, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className="loading-page" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner-lg" style={{ borderTopColor: 'var(--color-primary)' }} />
      </div>
    )
  }

  const navSections = profile ? getNavSections(profile.role) : []

  return (
    <AppContext.Provider value={{ profile, loading, refreshProfile: fetchProfile }}>
      <div className="app-layout">
        {/* Sidebar Overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="modal-overlay"
            style={{ zIndex: 99, background: 'rgba(0,0,0,0.5)', backdropFilter: 'none' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-logo-icon">A</div>
            <span className="sidebar-logo-text">AssetFlow</span>
          </div>

          <nav className="sidebar-nav">
            {navSections.map((section) => {
              if (section.items.length === 0) return null

              return (
                <div key={section.label}>
                  <div className="sidebar-section-label">{section.label}</div>
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${pathname === item.href.split('?')[0] || pathname.startsWith(item.href.split('?')[0] + '/') ? 'active' : ''}`}
                    >
                      <span className="sidebar-link-icon">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user" onClick={handleLogout} title="Click to sign out">
              <div className="sidebar-avatar">
                {profile ? getInitials(profile.name || profile.email) : '?'}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{profile?.name || 'User'}</div>
                <div className="sidebar-user-role">{profile?.role?.replace('_', ' ')}</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>⏻</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <header className="main-header">
            <div className="main-header-left">
              <button
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle navigation menu"
              >
                ☰
              </button>
              <h1 className="page-title">
                {navSections.flatMap(s => s.items).find(i =>
                  pathname === i.href || pathname.startsWith(i.href + '/')
                )?.label || 'AssetFlow'}
              </h1>
            </div>
            <div className="main-header-right">
              <Link href="/notifications" className="notification-bell">
                🔔
                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </header>

          <div className="page-content">
            {children}
          </div>
        </main>
      </div>
    </AppContext.Provider>
  )
}
