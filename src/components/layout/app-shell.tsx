"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Sun, Moon, Bell, X } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { useAlerts } from "@/hooks/use-alerts"
import { AppSidebar } from "./app-sidebar"
import { MobileNav } from "./mobile-nav"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { APP_NAME } from "@/lib/app-config"

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? "?"
}

import type { Tables } from "@/types/database"

interface AppShellProps {
  children: React.ReactNode
  initialProfile: Tables<"profiles"> | null
}

export function AppShell({ children, initialProfile }: AppShellProps) {
  const { profile, roleOverride } = useUser(initialProfile)
  const { theme, setTheme } = useTheme()
  const { alerts, unreadCount, dismiss } = useAlerts()

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar profile={profile} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Role override banner — dev only */}
        {roleOverride && (
          <div className="bg-destructive text-destructive-foreground text-center text-xs font-medium py-1 px-2">
            Dev Mode: viewing as <span className="font-bold">{roleOverride.replace("_", " ")}</span>
          </div>
        )}
        <header
          className="flex items-center justify-between bg-sidebar text-sidebar-foreground md:bg-background md:text-foreground md:border-b px-4 md:px-6"
          style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(3.5rem + env(safe-area-inset-top))" }}
        >
          {/* Mobile: app name in header */}
          <Link href="/dashboard" className="flex items-center gap-1.5 font-bold text-lg leading-none md:hidden">
            {APP_NAME}
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5 md:gap-3">
            {/* Alert bell */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="Notifications"
                  className="relative !size-8 !min-h-0 sm:!size-auto sm:!min-h-[unset] size-8 md:size-9 rounded-full flex items-center justify-center transition-colors text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent md:text-muted-foreground md:hover:text-foreground md:hover:bg-accent"
                >
                  <Bell className="size-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 border-b">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount === 0 && <p className="text-xs text-muted-foreground mt-0.5">All clear</p>}
                </div>
                {alerts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No active alerts</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="p-3 flex gap-2.5 items-start">
                        <span
                          className={`mt-0.5 shrink-0 size-2 rounded-full ${
                            alert.severity === "critical" ? "bg-destructive" :
                            alert.severity === "warning" ? "bg-yellow-500" :
                            "bg-blue-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{alert.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{alert.message}</p>
                          {alert.due_date && (
                            <p className="text-xs text-muted-foreground mt-0.5">Due: {alert.due_date}</p>
                          )}
                        </div>
                        <button
                          onClick={() => dismiss(alert.id)}
                          aria-label="Dismiss"
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode"
              className="size-8 md:size-9 rounded-full flex items-center justify-center transition-colors text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent md:text-muted-foreground md:hover:text-foreground md:hover:bg-accent"
            >
              <Sun className="size-[18px] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-[18px] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            </button>
<Link href="/profile" aria-label="Your profile" className="flex items-center">
              <Avatar size="default" className="cursor-pointer ring-2 ring-transparent hover:ring-sidebar-accent md:hover:ring-primary/20 transition-shadow">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground md:bg-primary/10 md:text-primary font-semibold">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>
        {/* paddingBottom accounts for fixed mobile nav + iPhone home indicator */}
        <main className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav profile={profile} />
    </div>
  )
}
