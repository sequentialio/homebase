"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Wallet,
  Calendar,
  MessageCircle,
  MoreHorizontal,
  Home,
  Users,
  Heart,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Tables } from "@/types/database"

type Profile = Tables<"profiles">

interface MobileNavProps {
  profile: Profile | null
}

interface NavItem {
  label: string
  href: string
  icon?: LucideIcon
  imageSrc?: string
  matchPrefixes: string[]
}

// ── Mobile bottom nav: 4 direct items + More ──────────────────────
const primaryItems: NavItem[] = [
  {
    label: "Finances",
    href: "/finances",
    icon: Wallet,
    matchPrefixes: ["/finances"],
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
]

// Items shown in the "More" drawer
const moreItems: NavItem[] = [
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
    label: "Settings",
    href: "/settings",
    icon: Settings,
    matchPrefixes: ["/settings"],
  },
]

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  if (!profile) return null

  const isMoreActive = moreItems.some((item) =>
    item.matchPrefixes.some((p) => pathname.startsWith(p))
  )

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-sidebar-border bg-sidebar md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {primaryItems.map((item) => {
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
                {item.imageSrc ? (
                  <Image
                    src={item.imageSrc}
                    alt=""
                    width={20}
                    height={20}
                    className={cn(
                      "size-5 object-contain [filter:brightness(0)_invert(1)] shrink-0",
                      !isActive && "opacity-50"
                    )}
                  />
                ) : item.icon ? (
                  <item.icon className="size-5 shrink-0" />
                ) : null}
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[44px] justify-center",
              isMoreActive
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60"
            )}
          >
            <MoreHorizontal className="size-5 shrink-0" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="bg-sidebar border-sidebar-border">
          <SheetHeader>
            <SheetTitle className="text-sidebar-foreground">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            {moreItems.map((item) => {
              const isActive = item.matchPrefixes.some((p) => pathname.startsWith(p))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                  )}
                >
                  {Icon && <Icon className="size-5" />}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
