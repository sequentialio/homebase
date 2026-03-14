"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

// ── Types ─────────────────────────────────────────────────────────

/**
 * Scope filter type for personal/business multi-tenant filtering.
 * Add more values here if your app needs additional scopes
 * (e.g. "shared" | "archived").
 */
export type ScopeFilter = "all" | "personal" | "business"

// ── Scope Filter Select ───────────────────────────────────────────

interface ScopeFilterSelectProps {
  value: ScopeFilter
  onChange: (value: ScopeFilter) => void
  /** Override the trigger width (default: 140px) */
  className?: string
}

export function ScopeFilterSelect({ value, onChange, className }: ScopeFilterSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ScopeFilter)}>
      <SelectTrigger className={className ?? "w-[140px]"}>
        <SelectValue placeholder="All scopes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="personal">Personal</SelectItem>
        <SelectItem value="business">Business</SelectItem>
      </SelectContent>
    </Select>
  )
}

// ── Scope Badge ───────────────────────────────────────────────────

/** Inline badge for displaying a record's scope. Returns null if scope is falsy. */
export function ScopeBadge({ scope }: { scope: string | null }) {
  if (!scope) return null
  return (
    <Badge
      variant={scope === "business" ? "default" : "outline"}
      className="capitalize text-xs"
    >
      {scope}
    </Badge>
  )
}

// ── Scope Filter Helper ──────────────────────────────────────────

/**
 * Client-side filter helper.
 * Records with a null/undefined scope are treated as "personal".
 *
 * Usage:
 *   const visible = filterByScope(records, scopeFilter)
 */
export function filterByScope<T extends { scope?: string | null }>(
  items: T[],
  scopeFilter: ScopeFilter
): T[] {
  if (scopeFilter === "all") return items
  return items.filter(
    (item) => item.scope === scopeFilter || (!item.scope && scopeFilter === "personal")
  )
}
