/**
 * KPI Card & Stat Item — Reusable dashboard primitives
 *
 * KPICard: large headline metric with icon (e.g. "Total Revenue: $24,500")
 * StatItem: compact 2-line label/value for grid layouts inside cards
 *
 * Both are purely presentational — pass the value pre-formatted as a string.
 *
 * Pattern from homebase app — generalized for reuse.
 */

import { Card, CardContent } from "@/components/ui/card"

// ── KPI Card ──────────────────────────────────────────────────────

interface KPICardProps {
  label: string
  value: string
  /** Lucide icon or any React component with optional className prop */
  icon?: React.ComponentType<{ className?: string }>
  /** Tailwind text color class applied to the value (e.g. "text-green-500") */
  valueClassName?: string
  /** Secondary line below the value */
  subtitle?: string
}

/**
 * Single headline metric card.
 *
 * @example
 * <KPICard label="Revenue" value="$24,500" icon={DollarSign} valueClassName="text-green-500" />
 */
export function KPICard({ label, value, icon: Icon, valueClassName, subtitle }: KPICardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <p className={`text-2xl font-bold tabular-nums ${valueClassName ?? ""}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Stat Item ─────────────────────────────────────────────────────

interface StatItemProps {
  label: string
  value: string
  /** Highlight value in amber when true (e.g. to draw attention to non-zero counts) */
  highlight?: boolean
}

/**
 * Compact label + large value for use inside card grids.
 *
 * @example
 * <div className="grid grid-cols-2 gap-3">
 *   <StatItem label="Open" value="12" highlight={openCount > 0} />
 *   <StatItem label="Closed" value="48" />
 * </div>
 */
export function StatItem({ label, value, highlight }: StatItemProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${highlight ? "text-amber-500" : ""}`}>
        {value}
      </p>
    </div>
  )
}
