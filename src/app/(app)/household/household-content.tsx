"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Tables } from "@/types/database"
import { GroceriesTab } from "./groceries-tab"
import { CleaningTab } from "./cleaning-tab"

type GroceryItem = Tables<"grocery_items">
type CleaningDuty = Tables<"cleaning_duties">

interface HouseholdContentProps {
  userId: string
  initialGroceryItems: GroceryItem[]
  initialCleaningDuties: CleaningDuty[]
  profiles: { id: string; full_name: string | null }[]
}

export function HouseholdContent({
  userId,
  initialGroceryItems,
  initialCleaningDuties,
  profiles,
}: HouseholdContentProps) {
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>(initialGroceryItems)

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Household</h1>

      <Tabs defaultValue="groceries">
        <TabsList className="!h-auto py-1 gap-1 flex-wrap">
          <TabsTrigger value="groceries">Shopping List</TabsTrigger>
          <TabsTrigger value="pantry">Pantry</TabsTrigger>
          <TabsTrigger value="cleaning">Cleaning</TabsTrigger>
        </TabsList>

        <TabsContent value="groceries" className="mt-4">
          <GroceriesTab
            userId={userId}
            items={groceryItems}
            setItems={setGroceryItems}
            view="shopping"
          />
        </TabsContent>

        <TabsContent value="pantry" className="mt-4">
          <GroceriesTab
            userId={userId}
            items={groceryItems}
            setItems={setGroceryItems}
            view="pantry"
          />
        </TabsContent>

        <TabsContent value="cleaning" className="mt-4">
          <CleaningTab
            userId={userId}
            initialDuties={initialCleaningDuties}
            profiles={profiles}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
