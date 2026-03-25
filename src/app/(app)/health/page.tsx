import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { HealthContent } from "./health-content"

export default async function HealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const dateStr = ninetyDaysAgo.toISOString().slice(0, 10)

  const [
    { data: weightLogs },
    { data: exerciseLogs },
    { data: profiles },
  ] = await Promise.all([
    (supabase as any).from("weight_logs").select("*").gte("date", dateStr).order("date", { ascending: true }),
    (supabase as any).from("exercise_logs").select("*").gte("date", dateStr).order("date", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ])

  return (
    <HealthContent
      userId={user.id}
      initialWeightLogs={weightLogs ?? []}
      initialExerciseLogs={exerciseLogs ?? []}
      profiles={profiles ?? []}
    />
  )
}
