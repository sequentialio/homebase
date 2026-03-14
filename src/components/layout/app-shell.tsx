"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Sun, Moon, CircleHelp } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { AppSidebar } from "./app-sidebar"
import { MobileNav } from "./mobile-nav"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { APP_NAME } from "@/lib/app-config"

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? "?"
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, loading, roleOverride } = useUser()
  const { theme, setTheme } = useTheme()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar profile={profile} />
      <div className="flex flex-1 flex-col min-w-0">
        {/* Role override banner — dev only */}
        {roleOverride && (
          <div className="bg-destructive text-destructive-foreground text-center text-xs font-medium py-1 px-2">
            Dev Mode: viewing as <span className="font-bold">{roleOverride.replace("_", " ")}</span>
            <span className="ml-1.5 opacity-75">— go to Help → Dev Tools to reset</span>
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
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle dark mode"
              className="size-8 md:size-9 rounded-full flex items-center justify-center transition-colors text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent md:text-muted-foreground md:hover:text-foreground md:hover:bg-accent"
            >
              <Sun className="size-[18px] rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-[18px] rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            </button>
            <Link
              href="/help"
              aria-label="Help"
              className="size-8 rounded-full flex items-center justify-center transition-colors text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent md:hidden"
            >
              <CircleHelp className="size-[18px]" />
            </Link>
            <Link href="/profile" aria-label="Your profile" className="flex items-center">
              <Avatar size="default" className="cursor-pointer ring-2 ring-transparent hover:ring-sidebar-accent md:hover:ring-primary/20 transition-shadow">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground md:bg-primary/10 md:text-primary font-semibold">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>
        {/* paddingBottom accounts for fixed mobile nav + iPhone home indicator */}
        <main className="flex-1 md:pb-0" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
          {children}
        </main>
      </div>
      <MobileNav profile={profile} />
    </div>
  )
}
