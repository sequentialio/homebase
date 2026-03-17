"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { freshnessLabel } from "@/lib/format-utils"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"

type CleaningDuty = Tables<"cleaning_duties">

const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"] as const
type Frequency = (typeof FREQUENCIES)[number]

const FREQUENCY_DAYS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
}

function calcNextDue(lastCompleted: string, frequency: Frequency): string {
  const d = new Date(lastCompleted)
  d.setDate(d.getDate() + FREQUENCY_DAYS[frequency])
  return d.toISOString().split("T")[0]
}

function dutyStatus(duty: CleaningDuty): "overdue" | "due-soon" | "ok" | "never" {
  if (!duty.last_completed) return "never"
  if (!duty.next_due) return "ok"
  const daysUntil = (new Date(duty.next_due).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (daysUntil < 0) return "overdue"
  if (daysUntil <= 3) return "due-soon"
  return "ok"
}

const STATUS_STYLES: Record<ReturnType<typeof dutyStatus>, string> = {
  overdue: "border-red-400/50 bg-red-500/5",
  "due-soon": "border-yellow-400/50 bg-yellow-500/5",
  ok: "",
  never: "border-dashed",
}

const STATUS_BADGE: Record<ReturnType<typeof dutyStatus>, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "text-red-600 dark:text-red-400 border-red-400/50" },
  "due-soon": { label: "Due soon", className: "text-yellow-600 dark:text-yellow-400 border-yellow-400/50" },
  ok: { label: "On track", className: "text-green-600 dark:text-green-400 border-green-400/50" },
  never: { label: "Not done yet", className: "text-muted-foreground" },
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  frequency: z.enum(FREQUENCIES),
  assigned_to: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

interface CleaningTabProps {
  userId: string
  initialDuties: CleaningDuty[]
  profiles: { id: string; full_name: string | null }[]
}

export function CleaningTab({ userId, initialDuties, profiles }: CleaningTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [duties, setDuties] = useState<CleaningDuty[]>(initialDuties)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CleaningDuty | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...duties].sort((a, b) => {
      const order = { overdue: 0, "due-soon": 1, never: 2, ok: 3 }
      return order[dutyStatus(a)] - order[dutyStatus(b)]
    })
  }, [duties])

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? "Unknown"])),
    [profiles]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      frequency: "weekly",
      assigned_to: null,
      notes: null,
    },
  })

  function openAdd() {
    form.reset({ name: "", frequency: "weekly", assigned_to: null, notes: null })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(duty: CleaningDuty) {
    form.reset({
      name: duty.name,
      frequency: duty.frequency as Frequency,
      assigned_to: duty.assigned_to ?? null,
      notes: duty.notes ?? null,
    })
    setEditing(duty)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      frequency: values.frequency,
      assigned_to: values.assigned_to || null,
      notes: values.notes || null,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("cleaning_duties")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update duty"); return }
      setDuties((prev) => prev.map((d) => (d.id === editing.id ? data : d)))
      toast.success("Duty updated")
    } else {
      const { data, error } = await supabase
        .from("cleaning_duties")
        .insert(payload)
        .select()
        .single()
      if (error) { toast.error("Failed to add duty"); return }
      setDuties((prev) => [...prev, data])
      toast.success("Duty added")
    }
    setOpen(false)
  }

  async function handleMarkDone(duty: CleaningDuty) {
    setCompleting(duty.id)
    const now = new Date().toISOString()
    const nextDue = calcNextDue(now, duty.frequency as Frequency)

    const { data, error } = await supabase
      .from("cleaning_duties")
      .update({ last_completed: now, next_due: nextDue })
      .eq("id", duty.id)
      .select()
      .single()

    if (error) { toast.error("Failed to mark done"); setCompleting(null); return }
    setDuties((prev) => prev.map((d) => (d.id === duty.id ? data : d)))
    toast.success(`Marked done — next due ${nextDue}`)
    setCompleting(null)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("cleaning_duties").delete().eq("id", id)
    if (error) { toast.error("Failed to delete"); setDeleting(null); return }
    setDuties((prev) => prev.filter((d) => d.id !== id))
    toast.success("Duty deleted")
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">
          {duties.length} {duties.length === 1 ? "duty" : "duties"}
        </span>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No cleaning duties yet — add your first one.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((duty) => {
            const status = dutyStatus(duty)
            const badge = STATUS_BADGE[status]
            return (
              <div
                key={duty.id}
                className={cn("flex items-center gap-3 rounded-lg border p-3", STATUS_STYLES[status])}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{duty.name}</span>
                    <Badge variant="outline" className={cn("text-xs capitalize", badge.className)}>
                      {badge.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground capitalize">
                      {duty.frequency}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {duty.assigned_to && profileMap[duty.assigned_to] && (
                      <span>{profileMap[duty.assigned_to]}</span>
                    )}
                    <span>·</span>
                    <span>Last done: {freshnessLabel(duty.last_completed)}</span>
                    {duty.next_due && <span>· Due {duty.next_due}</span>}
                    {duty.notes && <span>· {duty.notes}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!size-7 !min-h-0 text-green-600 hover:text-green-600 dark:text-green-400"
                    title="Mark as done"
                    onClick={() => handleMarkDone(duty)}
                    disabled={completing === duty.id}
                  >
                    <CheckCircle2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!size-7 !min-h-0"
                    onClick={() => openEdit(duty)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(duty.id)}
                    disabled={deleting === duty.id}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Duty" : "Add Cleaning Duty"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Task name</Label>
              <Input placeholder="e.g. Vacuum living room" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  value={form.watch("frequency")}
                  onValueChange={(v) => form.setValue("frequency", v as Frequency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Assigned to</Label>
                <Select
                  value={form.watch("assigned_to") ?? "unassigned"}
                  onValueChange={(v) => form.setValue("assigned_to", v === "unassigned" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Anyone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Anyone</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="e.g. Don't forget under the couch" {...form.register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
