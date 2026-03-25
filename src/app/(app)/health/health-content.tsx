"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Dumbbell,
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────

interface WeightLog {
  id: string
  user_id: string
  date: string
  weight: number
  notes: string | null
  created_at: string
}

interface ExerciseLog {
  id: string
  user_id: string
  date: string
  type: string
  duration_minutes: number
  distance: number | null
  calories: number | null
  notes: string | null
  created_at: string
}

interface Profile {
  id: string
  full_name: string | null
}

interface HealthContentProps {
  userId: string
  initialWeightLogs: WeightLog[]
  initialExerciseLogs: ExerciseLog[]
  profiles: Profile[]
}

// ── Schemas ────────────────────────────────────────────────────────────

const weightSchema = z.object({
  weight: z.number().positive("Weight must be positive"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
})
type WeightFormValues = z.infer<typeof weightSchema>

const exerciseSchema = z.object({
  type: z.string().min(1, "Type is required"),
  duration_minutes: z.number().positive("Duration must be positive"),
  distance: z.number().optional().nullable(),
  calories: z.number().optional().nullable(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
})
type ExerciseFormValues = z.infer<typeof exerciseSchema>

const EXERCISE_TYPES = ["Run", "Weights", "Yoga", "Walk", "Cycling", "Swimming", "HIIT", "Other"]

const today = () => new Date().toISOString().slice(0, 10)

function firstName(profiles: Profile[], userId: string): string {
  return profiles.find((p) => p.id === userId)?.full_name?.split(" ")[0] ?? "Unknown"
}

// ── Main Component ─────────────────────────────────────────────────────

export function HealthContent({
  userId,
  initialWeightLogs,
  initialExerciseLogs,
  profiles,
}: HealthContentProps) {
  const supabase = useMemo(() => createClient(), [])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(initialWeightLogs)
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>(initialExerciseLogs)
  const [activeTab, setActiveTab] = useState("weight")

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Health</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="!h-auto py-1 gap-1 flex-wrap">
          <TabsTrigger value="weight">
            <Scale className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">Weight</span>
          </TabsTrigger>
          <TabsTrigger value="exercise">
            <Dumbbell className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">Exercise</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weight" className="mt-4">
          <WeightTab
            userId={userId}
            logs={weightLogs}
            setLogs={setWeightLogs}
            profiles={profiles}
            supabase={supabase}
          />
        </TabsContent>

        <TabsContent value="exercise" className="mt-4">
          <ExerciseTab
            userId={userId}
            logs={exerciseLogs}
            setLogs={setExerciseLogs}
            profiles={profiles}
            supabase={supabase}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Weight Tab ─────────────────────────────────────────────────────────

function WeightTab({
  userId,
  logs,
  setLogs,
  profiles,
  supabase,
}: {
  userId: string
  logs: WeightLog[]
  setLogs: React.Dispatch<React.SetStateAction<WeightLog[]>>
  profiles: Profile[]
  supabase: any
}) {
  const [filter, setFilter] = useState<string>("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WeightLog | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(
    () => (filter === "all" ? logs : logs.filter((l) => l.user_id === filter)),
    [logs, filter]
  )

  // Chart data: pivot by date, one key per user
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {}
    for (const log of filtered) {
      if (!byDate[log.date]) byDate[log.date] = {}
      byDate[log.date][log.user_id] = log.weight
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date, ...users }))
  }, [filtered])

  // Stats per user
  const statsPerUser = useMemo(() => {
    const result: Record<string, { latest: number; thirtyDayChange: number | null; min: number; max: number }> = {}
    for (const profile of profiles) {
      const userLogs = logs.filter((l) => l.user_id === profile.id).sort((a, b) => a.date.localeCompare(b.date))
      if (userLogs.length === 0) continue
      const latest = userLogs[userLogs.length - 1].weight
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDayStr = thirtyDaysAgo.toISOString().slice(0, 10)
      const oldEntry = userLogs.find((l) => l.date >= thirtyDayStr)
      const thirtyDayChange = oldEntry ? latest - oldEntry.weight : null
      const weights = userLogs.map((l) => l.weight)
      result[profile.id] = { latest, thirtyDayChange, min: Math.min(...weights), max: Math.max(...weights) }
    }
    return result
  }, [logs, profiles])

  const form = useForm<WeightFormValues>({
    resolver: zodResolver(weightSchema),
    defaultValues: { weight: undefined as any, date: today(), notes: "" },
  })

  function openAdd() {
    setEditing(null)
    form.reset({ weight: undefined as any, date: today(), notes: "" })
    setOpen(true)
  }

  function openEdit(log: WeightLog) {
    setEditing(log)
    form.reset({ weight: log.weight, date: log.date, notes: log.notes ?? "" })
    setOpen(true)
  }

  async function onSubmit(values: WeightFormValues) {
    const payload = {
      user_id: userId,
      weight: values.weight,
      date: values.date,
      notes: values.notes || null,
    }

    if (editing) {
      const { data, error } = await (supabase as any)
        .from("weight_logs")
        .update({ weight: values.weight, notes: values.notes || null })
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      setLogs((prev) => prev.map((l) => (l.id === editing.id ? data : l)).sort((a, b) => a.date.localeCompare(b.date)))
      toast.success("Weight updated")
    } else {
      const { data, error } = await (supabase as any)
        .from("weight_logs")
        .upsert(payload, { onConflict: "user_id,date" })
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      setLogs((prev) => {
        const without = prev.filter((l) => !(l.user_id === data.user_id && l.date === data.date))
        return [...without, data].sort((a, b) => a.date.localeCompare(b.date))
      })
      toast.success("Weight logged")
    }
    setOpen(false)
  }

  async function handleDelete() {
    if (!deleting) return
    const { error } = await (supabase as any).from("weight_logs").delete().eq("id", deleting)
    if (error) { toast.error(error.message); return }
    setLogs((prev) => prev.filter((l) => l.id !== deleting))
    setDeleting(null)
    toast.success("Entry deleted")
  }

  const userIds = profiles.map((p) => p.id)

  return (
    <div className="space-y-6">
      {/* Filter + Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
        <PersonFilter profiles={profiles} value={filter} onChange={setFilter} />
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 sm:mr-1" />
          <span className="hidden sm:inline">Log Weight</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {profiles.map((p) => {
          const s = statsPerUser[p.id]
          if (!s) return null
          const name = firstName(profiles, p.id)
          return (
            <div key={p.id} className="rounded-lg border p-3 space-y-1">
              <p className="text-xs text-muted-foreground">{name}</p>
              <p className="text-xl font-bold">{s.latest} lbs</p>
              <div className="flex items-center gap-1 text-xs">
                {s.thirtyDayChange !== null && (
                  <>
                    {s.thirtyDayChange > 0 ? (
                      <TrendingUp className="size-3 text-red-400" />
                    ) : s.thirtyDayChange < 0 ? (
                      <TrendingDown className="size-3 text-green-400" />
                    ) : (
                      <Minus className="size-3 text-muted-foreground" />
                    )}
                    <span className={cn(
                      s.thirtyDayChange > 0 ? "text-red-400" : s.thirtyDayChange < 0 ? "text-green-400" : "text-muted-foreground"
                    )}>
                      {s.thirtyDayChange > 0 ? "+" : ""}{s.thirtyDayChange.toFixed(1)} (30d)
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Range: {s.min}–{s.max}
              </p>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-4">Weight Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: "12px" }}
                tickFormatter={(d) => {
                  const dt = new Date(d + "T00:00:00")
                  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: "12px" }}
                domain={["dataMin - 5", "dataMax + 5"]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
                labelFormatter={(d) =>
                  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                }
                formatter={(value: number, name: string) => [
                  `${value} lbs`,
                  firstName(profiles, name),
                ]}
              />
              <Legend formatter={(value) => firstName(profiles, value)} />
              {userIds.map((uid) => (
                <Line
                  key={uid}
                  type="monotone"
                  dataKey={uid}
                  stroke={uid === userId ? "#d2ff46" : "#3b82f6"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent entries table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Who</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="hidden sm:table-cell">Notes</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No weight entries yet
                </TableCell>
              </TableRow>
            )}
            {[...filtered].reverse().map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">
                  {new Date(log.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {firstName(profiles, log.user_id)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{log.weight} lbs</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                  {log.notes}
                </TableCell>
                <TableCell>
                  {log.user_id === userId && (
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="!size-8 !min-h-0" onClick={() => openEdit(log)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="!size-8 !min-h-0 text-destructive" onClick={() => setDeleting(log.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Weight" : "Log Weight"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  {...form.register("weight", { valueAsNumber: true })}
                />
                {form.formState.errors.weight && (
                  <p className="text-xs text-destructive">{form.formState.errors.weight.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-date">Date</Label>
                <Input id="w-date" type="date" {...form.register("date")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="w-notes">Notes (optional)</Label>
              <Input id="w-notes" {...form.register("notes")} placeholder="e.g. after morning run" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Update" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Exercise Tab ───────────────────────────────────────────────────────

function ExerciseTab({
  userId,
  logs,
  setLogs,
  profiles,
  supabase,
}: {
  userId: string
  logs: ExerciseLog[]
  setLogs: React.Dispatch<React.SetStateAction<ExerciseLog[]>>
  profiles: Profile[]
  supabase: any
}) {
  const [filter, setFilter] = useState<string>("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ExerciseLog | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(
    () => (filter === "all" ? logs : logs.filter((l) => l.user_id === filter)),
    [logs, filter]
  )

  // Bar chart: workouts per day (last 30 days), stacked by user
  const chartData = useMemo(() => {
    const thirtyAgo = new Date()
    thirtyAgo.setDate(thirtyAgo.getDate() - 30)
    const thirtyStr = thirtyAgo.toISOString().slice(0, 10)
    const recent = filtered.filter((l) => l.date >= thirtyStr)
    const byDate: Record<string, Record<string, number>> = {}
    for (const log of recent) {
      if (!byDate[log.date]) byDate[log.date] = {}
      byDate[log.date][log.user_id] = (byDate[log.date][log.user_id] || 0) + 1
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, users]) => ({ date, ...users }))
  }, [filtered])

  // Stats
  const stats = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    const weekStr = startOfWeek.toISOString().slice(0, 10)
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

    const thisWeek = filtered.filter((l) => l.date >= weekStr).length
    const thisMonth = filtered.filter((l) => l.date >= monthStr).length
    return { thisWeek, thisMonth }
  }, [filtered])

  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      type: "",
      duration_minutes: undefined as any,
      distance: null,
      calories: null,
      date: today(),
      notes: "",
    },
  })

  function openAdd() {
    setEditing(null)
    form.reset({
      type: "",
      duration_minutes: undefined as any,
      distance: null,
      calories: null,
      date: today(),
      notes: "",
    })
    setOpen(true)
  }

  function openEdit(log: ExerciseLog) {
    setEditing(log)
    form.reset({
      type: log.type,
      duration_minutes: log.duration_minutes,
      distance: log.distance,
      calories: log.calories,
      date: log.date,
      notes: log.notes ?? "",
    })
    setOpen(true)
  }

  async function onSubmit(values: ExerciseFormValues) {
    const payload = {
      user_id: userId,
      type: values.type,
      duration_minutes: values.duration_minutes,
      distance: values.distance || null,
      calories: values.calories || null,
      date: values.date,
      notes: values.notes || null,
    }

    if (editing) {
      const { user_id: _, ...updatePayload } = payload
      const { data, error } = await (supabase as any)
        .from("exercise_logs")
        .update(updatePayload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      setLogs((prev) =>
        prev.map((l) => (l.id === editing.id ? data : l)).sort((a, b) => b.date.localeCompare(a.date))
      )
      toast.success("Exercise updated")
    } else {
      const { data, error } = await (supabase as any)
        .from("exercise_logs")
        .insert(payload)
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      setLogs((prev) => [data, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
      toast.success("Exercise logged")
    }
    setOpen(false)
  }

  async function handleDelete() {
    if (!deleting) return
    const { error } = await (supabase as any).from("exercise_logs").delete().eq("id", deleting)
    if (error) { toast.error(error.message); return }
    setLogs((prev) => prev.filter((l) => l.id !== deleting))
    setDeleting(null)
    toast.success("Entry deleted")
  }

  // Group entries by date for display
  const grouped = useMemo(() => {
    const map = new Map<string, ExerciseLog[]>()
    for (const log of filtered) {
      const existing = map.get(log.date) || []
      existing.push(log)
      map.set(log.date, existing)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filtered])

  const userIds = profiles.map((p) => p.id)

  return (
    <div className="space-y-6">
      {/* Filter + Add */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
        <PersonFilter profiles={profiles} value={filter} onChange={setFilter} />
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 sm:mr-1" />
          <span className="hidden sm:inline">Log Exercise</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-xs text-muted-foreground">This Week</p>
          <p className="text-xl font-bold">{stats.thisWeek} workouts</p>
        </div>
        <div className="rounded-lg border p-3 space-y-1">
          <p className="text-xs text-muted-foreground">This Month</p>
          <p className="text-xl font-bold">{stats.thisMonth} workouts</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-4">Workouts Per Day (30d)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: "12px" }}
                tickFormatter={(d) => {
                  const dt = new Date(d + "T00:00:00")
                  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.5)"
                style={{ fontSize: "12px" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
                labelFormatter={(d) =>
                  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                }
                formatter={(value: number, name: string) => [
                  value,
                  firstName(profiles, name),
                ]}
              />
              <Legend formatter={(value) => firstName(profiles, value)} />
              {userIds.map((uid) => (
                <Bar
                  key={uid}
                  dataKey={uid}
                  stackId="workouts"
                  fill={uid === userId ? "#d2ff46" : "#3b82f6"}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grouped entries */}
      <div className="space-y-4">
        {grouped.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            No exercise entries yet
          </div>
        )}
        {grouped.map(([date, entries]) => (
          <div key={date} className="rounded-lg border overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 text-sm font-medium">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Distance</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Calories</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {firstName(profiles, log.user_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{log.duration_minutes}m</TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {log.distance ? `${log.distance} mi` : "—"}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {log.calories ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                      {log.notes}
                    </TableCell>
                    <TableCell>
                      {log.user_id === userId && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="!size-8 !min-h-0" onClick={() => openEdit(log)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="!size-8 !min-h-0 text-destructive" onClick={() => setDeleting(log.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Exercise" : "Log Exercise"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(v) => form.setValue("type", v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXERCISE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.type && (
                  <p className="text-xs text-destructive">{form.formState.errors.type.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-duration">Duration (min)</Label>
                <Input
                  id="e-duration"
                  type="number"
                  {...form.register("duration_minutes", { valueAsNumber: true })}
                />
                {form.formState.errors.duration_minutes && (
                  <p className="text-xs text-destructive">{form.formState.errors.duration_minutes.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="e-distance">Distance (mi)</Label>
                <Input
                  id="e-distance"
                  type="number"
                  step="0.1"
                  {...form.register("distance", { valueAsNumber: true })}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-calories">Calories</Label>
                <Input
                  id="e-calories"
                  type="number"
                  {...form.register("calories", { valueAsNumber: true })}
                  placeholder="optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-date">Date</Label>
                <Input id="e-date" type="date" {...form.register("date")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-notes">Notes (optional)</Label>
              <Input id="e-notes" {...form.register("notes")} placeholder="e.g. felt great, new PR" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Update" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Shared: Person Filter ──────────────────────────────────────────────

function PersonFilter({
  profiles,
  value,
  onChange,
}: {
  profiles: Profile[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={value === "all" ? "default" : "outline"}
        onClick={() => onChange("all")}
        className="text-xs"
      >
        Both
      </Button>
      {profiles.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant={value === p.id ? "default" : "outline"}
          onClick={() => onChange(p.id)}
          className="text-xs"
        >
          {firstName(profiles, p.id)}
        </Button>
      ))}
    </div>
  )
}
