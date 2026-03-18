import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { HouseholdContent } from "./household-content"

export default async function HouseholdPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [
    { data: groceryItems },
    { data: cleaningDuties },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("grocery_items").select("*").order("position"),
    supabase.from("cleaning_duties").select("*").order("position"),
    supabase.from("profiles").select("id, full_name"),
  ])

  return (
    <HouseholdContent
      userId={user.id}
      initialGroceryItems={groceryItems ?? []}
      initialCleaningDuties={cleaningDuties ?? []}
      profiles={profiles ?? []}
    />
  )
}
