"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Wallet,
  Home,
  Calendar,
  Bot,
  Settings,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { APP_NAME } from "@/lib/app-config"
import type { Tables } from "@/types/database"

type Profile = Tables<"profiles">

interface AppSidebarProps {
  profile: Profile | null
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0][0]?.toUpperCase() ?? "?"
}

// ── Nav config ────────────────────────────────────────────────────
// Edit this array to change navigation items. matchPrefixes controls
// which paths highlight this item as active.
const navItems = [
  {
    label: "Finances",
    href: "/finances",
    icon: Wallet,
    matchPrefixes: ["/finances"],
  },
  {
    label: "Household",
    href: "/household",
    icon: Home,
    matchPrefixes: ["/household"],
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: Calendar,
    matchPrefixes: ["/calendar"],
  },
  {
    label: "AI Assistant",
    href: "/assistant",
    icon: Bot,
    matchPrefixes: ["/assistant"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    matchPrefixes: ["/settings"],
  },
]

export function AppSidebar({ profile }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-sidebar-foreground">
          {APP_NAME}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = item.matchPrefixes.some((p) => pathname.startsWith(p))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
            pathname === "/profile"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Avatar size="sm">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />
            ) : null}
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-[10px] font-semibold">
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <div className="truncate">{profile?.full_name || "Profile"}</div>
            <div className="text-xs text-sidebar-foreground/50 capitalize">
              {profile?.role?.replace("_", " ")}
            </div>
          </div>
        </Link>
        <Separator className="my-2 bg-sidebar-border" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut className="size-4" />
          {signingOut ? "Signing out..." : "Sign Out"}
        </Button>
      </div>
    </aside>
  )
}
