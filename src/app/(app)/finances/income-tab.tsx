"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmploymentTab } from "./employment-tab"
import { BusinessTab } from "./business-tab"
import type { Tables } from "@/types/database"

interface IncomeTabProps {
  userId: string
  initialIncomeSources: Tables<"income_sources">[]
  initialEngagements: Tables<"business_engagements">[]
}

export function IncomeTab({ userId, initialIncomeSources, initialEngagements }: IncomeTabProps) {
  return (
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
  )
}
