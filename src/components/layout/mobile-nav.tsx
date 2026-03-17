"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Wallet,
  Home,
  Calendar,
  Bot,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"

type Profile = Tables<"profiles">

interface MobileNavProps {
  profile: Profile | null
}

// ── Nav config ────────────────────────────────────────────────────
// Keep in sync with app-sidebar.tsx. Max 5 items for mobile bottom nav.
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
    label: "Assistant",
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

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname()

  if (!profile) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {navItems.map((item) => {
          const isActive = item.matchPrefixes.some((p) => pathname.startsWith(p))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[44px] justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                isActive
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60"
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="truncate max-w-full">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
