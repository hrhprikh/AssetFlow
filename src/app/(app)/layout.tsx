'use client'

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { Profile } from '@/lib/types'
import Link from 'next/link'
import {
  LayoutDashboard, Building2, Users, Package, Link as LinkIcon,
  CalendarRange, Wrench, ClipboardCheck, TrendingUp, FileText,
  Bell, RefreshCw, User, LogOut, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ---- Context ----
interface AppContextType {
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppContextType>({
  profile: null,
  loading: true,
  refreshProfile: async () => { },
})

export function useApp() {
  return useContext(AppContext)
}

// ---- Navigation Config ----
interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles?: string[]
}

const getNavSections = (role: string): { label: string; items: NavItem[] }[] => {
  switch (role) {
    case 'ADMIN':
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          ],
        },
        {
          label: 'Management',
          items: [
            { label: 'Organization Setup', href: '/organization', icon: Building2 },
            //   { label: 'Employee Directory', href: '/organization?tab=employees', icon: Users },
            // 
          ]
        },
        {
          label: 'Assets',
          items: [
            { label: 'Assets', href: '/assets', icon: Package },
            { label: 'Allocations', href: '/allocations', icon: LinkIcon },
            { label: 'Bookings', href: '/bookings', icon: CalendarRange },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Maintenance', href: '/maintenance', icon: Wrench },
            { label: 'Audits', href: '/audits', icon: ClipboardCheck },
            { label: 'Reports', href: '/reports', icon: TrendingUp },
            { label: 'Activity Logs', href: '/logs', icon: FileText },
          ],
        },
      ];
    case 'ASSET_MANAGER':
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          ],
        },
        {
          label: 'Assets',
          items: [
            { label: 'Assets', href: '/assets', icon: Package },
            { label: 'Allocations', href: '/allocations', icon: LinkIcon },
            { label: 'Transfers', href: '/transfers', icon: RefreshCw },
          ],
        },
        {
          label: 'Operations',
          items: [
            { label: 'Maintenance', href: '/maintenance', icon: Wrench },
            { label: 'Audits', href: '/audits', icon: ClipboardCheck },
            { label: 'Reports', href: '/reports', icon: TrendingUp },
          ],
        },
      ];
    case 'DEPARTMENT_HEAD':
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          ],
        },
        {
          label: 'Department',
          items: [
            { label: 'Department Assets', href: '/assets', icon: Package },
            { label: 'Transfers', href: '/transfers', icon: RefreshCw },
            { label: 'Bookings', href: '/bookings', icon: CalendarRange },
            { label: 'Audits', href: '/audits', icon: ClipboardCheck },
          ],
        },
      ];
    default: // EMPLOYEE
      return [
        {
          label: 'Overview',
          items: [
            { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { label: 'Notifications', href: '/notifications', icon: Bell },
          ],
        },
        {
          label: 'Personal',
          items: [
            { label: 'My Assets', href: '/assets?scope=mine', icon: Package },
            { label: 'Book Resources', href: '/assets?scope=bookable', icon: CalendarRange },
            { label: 'My Bookings', href: '/bookings', icon: CalendarRange },
            { label: 'Maintenance Requests', href: '/maintenance', icon: Wrench },
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

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!loading && profile) {
      const allowedSections = getNavSections(profile.role)
      const allowedHrefs = allowedSections.flatMap(s => s.items.map(i => i.href.split('?')[0]))

      // Always allow these paths regardless of role
      const universalPaths = ['/notifications', '/profile']

      const isAllowed = allowedHrefs.some(href =>
        pathname === href || pathname.startsWith(href + '/')
      ) || universalPaths.some(p => pathname === p || pathname.startsWith(p + '/'))

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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const navSections = profile ? getNavSections(profile.role) : []

  return (
    <AppContext.Provider value={{ profile, loading, refreshProfile: fetchProfile }}>
      <div className="flex min-h-screen bg-muted/40">

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/80 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-background transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-16 shrink-0 items-center border-b px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              A
            </div>
            <span className="ml-3 text-lg font-semibold tracking-tight">AssetFlow</span>
            <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {navSections.map((section) => {
              if (section.items.length === 0) return null

              return (
                <div key={section.label}>
                  <div className="mb-2 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {section.label}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href.split('?')[0] || pathname.startsWith(item.href.split('?')[0] + '/')
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="border-t p-4">
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted cursor-pointer transition-colors"
              onClick={handleLogout}
              title="Click to sign out"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                {profile ? getInitials(profile.name || profile.email) : '?'}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-sm font-medium">{profile?.name || 'User'}</div>
                <div className="truncate text-xs text-muted-foreground capitalize">{profile?.role?.replace('_', ' ').toLowerCase()}</div>
              </div>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex w-full flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold tracking-tight">
                {navSections.flatMap(s => s.items).find(i =>
                  pathname === i.href || pathname.startsWith(i.href + '/')
                )?.label || 'AssetFlow'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/notifications" className="relative text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </header>

          <div className="flex-1 p-4 md:p-8 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </AppContext.Provider>
  )
}
