"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Wallet,
  Home,
  Calendar,
  Settings,
  LogOut,
  Download,
  Users,
  Heart,
  MessageCircle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { APP_NAME } from "@/lib/app-config"
import { usePwaInstall } from "@/hooks/use-pwa-install"
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

interface NavItem {
  label: string
  href: string
  icon?: LucideIcon
  imageSrc?: string
  matchPrefixes: string[]
}

// ── Nav config ────────────────────────────────────────────────────
// Edit this array to change navigation items. matchPrefixes controls
// which paths highlight this item as active.
const navItems: NavItem[] = [
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
    label: "Shared",
    href: "/shared",
    icon: Users,
    matchPrefixes: ["/shared"],
  },
  {
    label: "Health",
    href: "/health",
    icon: Heart,
    matchPrefixes: ["/health"],
  },
  {
    label: "Together",
    href: "/together",
    icon: MessageCircle,
    matchPrefixes: ["/together"],
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: Calendar,
    matchPrefixes: ["/calendar"],
  },
  {
    label: "Assistant",
    href: "/assistant",
    imageSrc: "/logos/claude-logo.png",
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
  const supabase = useMemo(() => createClient(), [])
  const [signingOut, setSigningOut] = useState(false)
  const { canInstall, install } = usePwaInstall()

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logos/mita_full_cropped.png"
            alt="MITA"
            width={180}
            height={60}
            className="object-contain h-7 w-auto"
          />
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
              {item.imageSrc ? (
                <Image
                  src={item.imageSrc}
                  alt=""
                  width={16}
                  height={16}
                  className={cn(
                    "size-4 object-contain [filter:brightness(0)_invert(1)] shrink-0",
                    !isActive && "opacity-50"
                  )}
                />
              ) : item.icon ? (
                <item.icon className="size-4" />
              ) : null}
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
        {canInstall && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
            onClick={install}
          >
            <Download className="size-4" />
            Install App
          </Button>
        )}
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
