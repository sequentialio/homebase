"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { AppSidebar } from "./app-sidebar"
import { MobileNav } from "./mobile-nav"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
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
