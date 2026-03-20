"use client"

import { useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmploymentTab } from "./employment-tab"
import { BusinessTab } from "./business-tab"
import { formatCurrency } from "@/lib/format-utils"
import type { Tables } from "@/types/database"

type IncomeSource = Tables<"income_sources">
type BusinessEngagement = Tables<"business_engagements">

const FREQ_MULT: Record<string, number> = {
  weekly: 52, biweekly: 26, monthly: 12, annually: 1, quarterly: 4, "one-time": 0,
}

interface IncomeTabProps {
  userId: string
  initialIncomeSources: IncomeSource[]
  initialEngagements: BusinessEngagement[]
}

function IncomeSummary({
  sources,
  engagements,
}: {
  sources: IncomeSource[]
  engagements: BusinessEngagement[]
}) {
  const stats = useMemo(() => {
    const active = sources.filter((s) => s.active)

    const empNet = active.reduce((sum, s) => {
      return sum + Number(s.amount) * (FREQ_MULT[s.frequency] ?? 0)
    }, 0)

    const empGross = active.reduce((sum, s) => {
      if (!s.gross_amount) return sum
      return sum + Number(s.gross_amount) * (FREQ_MULT[s.frequency] ?? 0)
    }, 0)

    const empBonus = active.reduce((sum, s) => {
      if (!s.bonus_amount) return sum
      return sum + Number(s.bonus_amount) * (FREQ_MULT[s.bonus_frequency ?? "annually"] ?? 1)
    }, 0)

    const bizGross = engagements.reduce((sum, e) => sum + Number(e.amount), 0)
    const bizTaxes = engagements.reduce((sum, e) => sum + Number(e.taxes_owed ?? 0), 0)
    const bizNet = engagements.reduce((sum, e) => sum + Number(e.revenue ?? 0), 0)

    const totalGross = (empGross || empNet) + empBonus + bizGross
    const totalNet = empNet + empBonus + bizNet

    return { empNet, empGross: empGross || null, empBonus, bizGross, bizTaxes, bizNet, totalGross, totalNet }
  }, [sources, engagements])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="rounded-lg border p-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Employment (Net/yr)</p>
        <p className="text-lg font-bold text-green-500">{formatCurrency(stats.empNet)}</p>
        {stats.empGross && (
          <p className="text-xs text-muted-foreground">Gross: {formatCurrency(stats.empGross)}</p>
        )}
        {stats.empBonus > 0 && (
          <p className="text-xs text-amber-500">+ {formatCurrency(stats.empBonus)} bonus</p>
        )}
      </div>
      <div className="rounded-lg border p-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Business (Gross)</p>
        <p className="text-lg font-bold">{formatCurrency(stats.bizGross)}</p>
        <p className="text-xs text-muted-foreground">Taxes: {formatCurrency(stats.bizTaxes)}</p>
        <p className="text-xs text-green-500">Net: {formatCurrency(stats.bizNet)}</p>
      </div>
      <div className="rounded-lg border p-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total Gross</p>
        <p className="text-lg font-bold">{formatCurrency(stats.totalGross)}</p>
        <p className="text-xs text-muted-foreground">All sources combined</p>
      </div>
      <div className="rounded-lg border p-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Total Net</p>
        <p className="text-lg font-bold text-green-500">{formatCurrency(stats.totalNet)}</p>
        <p className="text-xs text-muted-foreground">Take-home + biz revenue</p>
      </div>
    </div>
  )
}

export function IncomeTab({ userId, initialIncomeSources, initialEngagements }: IncomeTabProps) {
  return (
    <div>
      <IncomeSummary sources={initialIncomeSources} engagements={initialEngagements} />

      <Tabs defaultValue="employment">
        <TabsList className="!h-auto py-1 gap-1">
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>

        <TabsContent value="employment" className="mt-4">
          <EmploymentTab userId={userId} initialIncomeSources={initialIncomeSources} />
        </TabsContent>

        <TabsContent value="business" className="mt-4">
          <BusinessTab userId={userId} initialEngagements={initialEngagements} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
