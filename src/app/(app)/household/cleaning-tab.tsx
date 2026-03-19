"use client"

import { useMemo, useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { freshnessLabel } from "@/lib/format-utils"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, CheckCircle2, GripVertical, ChevronDown, ChevronRight } from "lucide-react"
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
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  closestCenter,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"

type CleaningDuty = Tables<"cleaning_duties"> & {
  room?: string | null
  position?: number | null
}

const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"] as const
type Frequency = (typeof FREQUENCIES)[number]

const FREQUENCY_DAYS: Record<Frequency, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
}

const ROOM_SUGGESTIONS = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living Room",
  "Office",
  "Outdoor",
  "General",
] as const

const DEFAULT_ROOM = "General"
type RoomSuggestion = (typeof ROOM_SUGGESTIONS)[number]

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
  "due-soon": {
    label: "Due soon",
    className: "text-yellow-600 dark:text-yellow-400 border-yellow-400/50",
  },
  ok: { label: "On track", className: "text-green-600 dark:text-green-400 border-green-400/50" },
  never: { label: "Not done yet", className: "text-muted-foreground" },
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  frequency: z.enum(FREQUENCIES),
  assigned_to: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

interface CleaningTabProps {
  userId: string
  initialDuties: CleaningDuty[]
  profiles: { id: string; full_name: string | null }[]
}

// ─── Sortable duty row ────────────────────────────────────────────────────────

interface SortableDutyRowProps {
  duty: CleaningDuty
  profileMap: Record<string, string>
  completing: string | null
  deleting: string | null
  onMarkDone: (duty: CleaningDuty) => void
  onEdit: (duty: CleaningDuty) => void
  onDelete: (id: string) => void
  overlay?: boolean
}

function SortableDutyRow({
  duty,
  profileMap,
  completing,
  deleting,
  onMarkDone,
  onEdit,
  onDelete,
  overlay = false,
}: SortableDutyRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: duty.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
  }

  const status = dutyStatus(duty)
  const badge = STATUS_BADGE[status]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3",
        STATUS_STYLES[status],
        overlay && "shadow-lg bg-card"
      )}
    >
      {/* Drag handle */}
      <button
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>

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
          onClick={() => onMarkDone(duty)}
          disabled={completing === duty.id}
        >
          <CheckCircle2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="!size-7 !min-h-0"
          onClick={() => onEdit(duty)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="!size-7 !min-h-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(duty.id)}
          disabled={deleting === duty.id}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CleaningTab({ userId, initialDuties, profiles }: CleaningTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [duties, setDuties] = useState<CleaningDuty[]>(initialDuties)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CleaningDuty | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Keep a ref so DnD callbacks never go stale
  const dutiesRef = useRef<CleaningDuty[]>(duties)
  dutiesRef.current = duties

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? "Unknown"])),
    [profiles]
  )

  // All unique rooms across existing duties + suggestions for datalist
  const allRoomOptions = useMemo(() => {
    const fromDuties = duties.map((d) => d.room).filter(Boolean) as string[]
    return Array.from(new Set([...ROOM_SUGGESTIONS, ...fromDuties])).sort()
  }, [duties])

  // Build room groups from data
  const groups = useMemo(() => {
    const map = new Map<string, CleaningDuty[]>()

    for (const duty of duties) {
      const key = duty.room ?? DEFAULT_ROOM
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(duty)
    }

    // Sort within each group by position
    for (const [key, groupDuties] of map) {
      map.set(
        key,
        [...groupDuties].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      )
    }

    // Order groups: known suggestions first (in order), then any custom rooms alphabetically
    const ordered: [string, CleaningDuty[]][] = []
    for (const room of ROOM_SUGGESTIONS) {
      if (map.has(room)) {
        ordered.push([room, map.get(room)!])
      }
    }
    for (const [key, value] of map) {
      if (!ROOM_SUGGESTIONS.includes(key as RoomSuggestion)) {
        ordered.push([key, value])
      }
    }

    return ordered
  }, [duties])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function findContainer(id: string): string | null {
    const duty = dutiesRef.current.find((d) => d.id === id)
    return duty ? (duty.room ?? DEFAULT_ROOM) : null
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Persist positions ──────────────────────────────────────────────────────

  async function persistPositions(groupDuties: CleaningDuty[]) {
    const results = await Promise.all(
      groupDuties.map((d, i) =>
        supabase.from("cleaning_duties").update({ position: i }).eq("id", d.id)
      )
    )
    if (results.some((r) => r.error)) toast.error("Failed to save order")
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string) ?? (over.id as string)

    if (!activeContainer || activeContainer === overContainer) return

    // Move duty to new room group live
    setDuties((prev) =>
      prev.map((duty) =>
        duty.id === active.id
          ? { ...duty, room: overContainer === DEFAULT_ROOM ? null : overContainer }
          : duty
      )
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string) ?? activeContainer

    if (!activeContainer || !overContainer) return

    const currentDuties = dutiesRef.current

    if (activeContainer === overContainer) {
      // Same-group reorder
      const groupDuties = currentDuties.filter(
        (d) => (d.room ?? DEFAULT_ROOM) === activeContainer
      )
      const sorted = [...groupDuties].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const oldIndex = sorted.findIndex((d) => d.id === active.id)
      const newIndex = sorted.findIndex((d) => d.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(sorted, oldIndex, newIndex)

      // Update state
      setDuties((prev) => {
        const byId = new Map(reordered.map((duty, i) => [duty.id, { ...duty, position: i }]))
        return prev.map((duty) => byId.get(duty.id) ?? duty)
      })

      // Persist separately — never inside setState callback
      void persistPositions(reordered)
    } else {
      // Cross-group: room already updated in onDragOver — persist new room + positions
      const newRoom = overContainer === DEFAULT_ROOM ? null : overContainer

      const updateRoom = async () => {
        const { error } = await supabase
          .from("cleaning_duties")
          .update({ room: newRoom } as never)
          .eq("id", active.id as string)
        if (error) {
          toast.error("Failed to move duty")
          return
        }

        // Persist positions for destination group
        const destDuties = dutiesRef.current.filter(
          (d) => (d.room ?? DEFAULT_ROOM) === overContainer
        )
        await persistPositions(destDuties)
      }

      void updateRoom()
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      frequency: "weekly",
      assigned_to: null,
      notes: null,
      room: DEFAULT_ROOM,
    },
  })

  function openAdd() {
    form.reset({ name: "", frequency: "weekly", assigned_to: null, notes: null, room: DEFAULT_ROOM })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(duty: CleaningDuty) {
    form.reset({
      name: duty.name,
      frequency: duty.frequency as Frequency,
      assigned_to: duty.assigned_to ?? null,
      notes: duty.notes ?? null,
      room: duty.room ?? DEFAULT_ROOM,
    })
    setEditing(duty)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const room = values.room === DEFAULT_ROOM ? null : (values.room || null)

    if (editing) {
      const payload = {
        name: values.name,
        frequency: values.frequency,
        assigned_to: values.assigned_to || null,
        notes: values.notes || null,
        room,
      }
      const { data, error } = await supabase
        .from("cleaning_duties")
        .update(payload as never)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) {
        toast.error("Failed to update duty")
        return
      }
      setDuties((prev) => prev.map((d) => (d.id === editing.id ? data : d)))
      toast.success("Duty updated")
    } else {
      // Set next_due from today so it appears on the calendar immediately
      const nextDue = calcNextDue(new Date().toISOString(), values.frequency)
      const payload = {
        name: values.name,
        frequency: values.frequency,
        assigned_to: values.assigned_to || null,
        notes: values.notes || null,
        room,
        next_due: nextDue,
      }
      const { data, error } = await supabase
        .from("cleaning_duties")
        .insert(payload as never)
        .select()
        .single()
      if (error) {
        toast.error("Failed to add duty")
        return
      }
      setDuties((prev) => [...prev, data])
      toast.success(`Duty added — first due ${nextDue}`)
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

    if (error) {
      toast.error("Failed to mark done")
      setCompleting(null)
      return
    }
    setDuties((prev) => prev.map((d) => (d.id === duty.id ? data : d)))
    toast.success(`Marked done — next due ${nextDue}`)
    setCompleting(null)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("cleaning_duties").delete().eq("id", id)
    if (error) {
      toast.error("Failed to delete")
      setDeleting(null)
      return
    }
    setDuties((prev) => prev.filter((d) => d.id !== id))
    toast.success("Duty deleted")
    setDeleting(null)
  }

  // Active item for DragOverlay
  const activeItem = activeId ? dutiesRef.current.find((d) => d.id === activeId) : null

  const overdueCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const duty of duties) {
      const key = duty.room ?? DEFAULT_ROOM
      if (dutyStatus(duty) === "overdue") {
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
    return counts
  }, [duties])

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
      {duties.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No cleaning duties yet — add your first one.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4">
            {groups.map(([roomKey, roomDuties]) => {
              const isCollapsed = collapsedGroups.has(roomKey)
              const overdueCount = overdueCounts[roomKey] ?? 0
              return (
                <div key={roomKey} className="space-y-1">
                  {/* Room group header */}
                  <button
                    className="flex items-center gap-1.5 w-full text-left py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toggleGroup(roomKey)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="size-3.5 shrink-0" />
                    )}
                    <span>{roomKey}</span>
                    <span className="font-normal normal-case tracking-normal">
                      ({roomDuties.length})
                    </span>
                    {overdueCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs text-red-600 dark:text-red-400 border-red-400/50 ml-1 font-normal normal-case tracking-normal"
                      >
                        {overdueCount} overdue
                      </Badge>
                    )}
                  </button>

                  {!isCollapsed && (
                    <SortableContext
                      items={roomDuties.map((d) => d.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {roomDuties.map((duty) => (
                          <SortableDutyRow
                            key={duty.id}
                            duty={duty}
                            profileMap={profileMap}
                            completing={completing}
                            deleting={deleting}
                            onMarkDone={handleMarkDone}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>
              )
            })}
          </div>

          <DragOverlay>
            {activeItem ? (
              <SortableDutyRow
                duty={activeItem}
                profileMap={profileMap}
                completing={null}
                deleting={null}
                onMarkDone={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
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
                      <SelectItem key={f} value={f} className="capitalize">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Room</Label>
                <Input
                  placeholder="e.g. Kitchen"
                  list="room-options"
                  {...form.register("room")}
                />
                <datalist id="room-options">
                  {allRoomOptions.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
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

            <div className="space-y-1.5">
              <Label>
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. Don't forget under the couch"
                {...form.register("notes")}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
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
