"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Plus, X, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"
import { TasksContent } from "@/app/(app)/tasks/tasks-content"

type CalendarEvent = Tables<"calendar_events">
type View = "month" | "week" | "3day"

interface AsanaTask {
  gid: string
  name: string
  due_on: string
  completed: boolean
  permalink_url?: string
}

interface CleaningDuty {
  id: string
  name: string
  next_due: string | null
}

interface GoogleEvent {
  id: string
  summary: string
  start: string | null
  end: string | null
  allDay: boolean
  htmlLink: string | null
}

interface CalendarEntry {
  type: "homebase" | "asana" | "cleaning" | "google"
  id?: string
  title: string
  url?: string
  allDay: boolean
  startHour?: number
  startMinute?: number
  endHour?: number
  endMinute?: number
}

interface CalendarContentProps {
  userId: string
  initialEvents: CalendarEvent[]
  cleaningDuties: CleaningDuty[]
  hasAsana: boolean
  hasGoogle: boolean
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// Hours shown in time grid (7am - 10pm)
const GRID_START_HOUR = 7
const GRID_END_HOUR = 22
const GRID_HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => i + GRID_START_HOUR)

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM"
  if (h === 12) return "12 PM"
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function formatTimeRange(entry: CalendarEntry): string {
  if (entry.allDay) return "All day"
  if (entry.startHour == null) return ""
  const fmt = (h: number, m: number) => {
    const suffix = h >= 12 ? "PM" : "AM"
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
    return m > 0 ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`
  }
  const start = fmt(entry.startHour, entry.startMinute ?? 0)
  if (entry.endHour != null) {
    const end = fmt(entry.endHour, entry.endMinute ?? 0)
    return `${start} – ${end}`
  }
  return start
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getWeekStart(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - r.getDay()) // Sunday
  return r
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  start_at: z.string().min(1, "Date is required"),
  end_at: z.string().optional(),
  all_day: z.boolean(),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const TYPE_COLOR: Record<CalendarEntry["type"], string> = {
  homebase: "bg-primary",
  asana: "bg-blue-500",
  google: "bg-red-500",
  cleaning: "bg-orange-500",
}

const TYPE_COLOR_BORDER: Record<CalendarEntry["type"], string> = {
  homebase: "border-l-primary bg-primary/10",
  asana: "border-l-blue-500 bg-blue-500/10",
  google: "border-l-red-500 bg-red-500/10",
  cleaning: "border-l-orange-500 bg-orange-500/10",
}

export function CalendarContent({
  userId,
  initialEvents,
  cleaningDuties,
  hasAsana,
  hasGoogle,
}: CalendarContentProps) {
  const supabase = useMemo(() => createClient(), [])
  const now = new Date()
  const todayKey = dateKey(now)

  const [view, setView] = useState<View>("month")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [viewDate, setViewDate] = useState(now)

  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [asanaTasks, setAsanaTasks] = useState<AsanaTask[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [asanaLoading, setAsanaLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addDate, setAddDate] = useState<string>("")

  const timeGridRef = useRef<HTMLDivElement>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", start_at: "", end_at: "", all_day: true, description: "" },
  })

  // Keep year/month in sync with viewDate for data fetching
  useEffect(() => {
    if (view !== "month") {
      const vd = viewDate
      if (vd.getFullYear() !== year || vd.getMonth() !== month) {
        setYear(vd.getFullYear())
        setMonth(vd.getMonth())
      }
    }
  }, [viewDate, view, year, month])

  // Fetch Asana tasks when month changes
  useEffect(() => {
    if (!hasAsana) return
    setAsanaLoading(true)
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`
    fetch(`/api/asana/tasks/calendar?month=${monthStr}`)
      .then((r) => r.json())
      .then((d) => setAsanaTasks(d.tasks ?? []))
      .catch(() => setAsanaTasks([]))
      .finally(() => setAsanaLoading(false))
  }, [year, month, hasAsana])

  // Fetch Google Calendar events when month changes
  useEffect(() => {
    if (!hasGoogle) return
    setGoogleLoading(true)
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`
    fetch(`/api/google/events?month=${monthStr}`)
      .then((r) => r.json())
      .then((d) => setGoogleEvents(d.events ?? []))
      .catch(() => setGoogleEvents([]))
      .finally(() => setGoogleLoading(false))
  }, [year, month, hasGoogle])

  // Scroll time grid to 8am on mount/view change
  useEffect(() => {
    if ((view === "week" || view === "3day") && timeGridRef.current) {
      const hourHeight = 60
      timeGridRef.current.scrollTop = (8 - GRID_START_HOUR) * hourHeight
    }
  }, [view])

  // Build dateKey → entries map (richer than the old dayEvents)
  const dateEvents = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()

    const add = (key: string, entry: CalendarEntry) => {
      const existing = map.get(key) ?? []
      map.set(key, [...existing, entry])
    }

    // HomeBase events
    events.forEach((e) => {
      const d = new Date(e.start_at)
      const key = dateKey(d)
      const allDay = e.all_day ?? true
      add(key, {
        type: "homebase",
        id: e.id,
        title: e.title,
        allDay,
        startHour: allDay ? undefined : d.getHours(),
        startMinute: allDay ? undefined : d.getMinutes(),
        endHour: (!allDay && e.end_at) ? new Date(e.end_at).getHours() : undefined,
        endMinute: (!allDay && e.end_at) ? new Date(e.end_at).getMinutes() : undefined,
      })
    })

    // Asana tasks (all-day)
    asanaTasks.forEach((t) => {
      if (!t.due_on) return
      add(t.due_on, {
        type: "asana",
        title: t.name,
        url: t.permalink_url,
        allDay: true,
      })
    })

    // Google Calendar events
    googleEvents.forEach((evt) => {
      if (!evt.start) return
      const key = evt.start.slice(0, 10)
      if (evt.allDay) {
        add(key, { type: "google", title: evt.summary, url: evt.htmlLink ?? undefined, allDay: true })
      } else {
        const startDate = new Date(evt.start)
        const endDate = evt.end ? new Date(evt.end) : null
        add(key, {
          type: "google",
          title: evt.summary,
          url: evt.htmlLink ?? undefined,
          allDay: false,
          startHour: startDate.getHours(),
          startMinute: startDate.getMinutes(),
          endHour: endDate?.getHours(),
          endMinute: endDate?.getMinutes(),
        })
      }
    })

    // Cleaning duties (all-day)
    cleaningDuties.forEach((duty) => {
      if (!duty.next_due) return
      add(duty.next_due, { type: "cleaning", title: duty.name, allDay: true })
    })

    return map
  }, [events, asanaTasks, googleEvents, cleaningDuties])

  // Navigation
  function navigate(dir: -1 | 1) {
    if (view === "month") {
      if (dir === -1) {
        if (month === 0) { setYear(y => y - 1); setMonth(11) }
        else setMonth(m => m - 1)
      } else {
        if (month === 11) { setYear(y => y + 1); setMonth(0) }
        else setMonth(m => m + 1)
      }
      setSelectedDay(null)
    } else if (view === "week") {
      setViewDate(d => addDays(d, dir * 7))
    } else {
      setViewDate(d => addDays(d, dir * 3))
    }
  }

  function goToday() {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setViewDate(today)
    setSelectedDay(null)
  }

  // Navigation title
  const navTitle = useMemo(() => {
    if (view === "month") return `${MONTHS[month]} ${year}`
    if (view === "week") {
      const start = getWeekStart(viewDate)
      const end = addDays(start, 6)
      if (start.getMonth() === end.getMonth()) {
        return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
      }
      return `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`
    }
    // 3day
    const end = addDays(viewDate, 2)
    if (viewDate.getMonth() === end.getMonth()) {
      return `${MONTHS[viewDate.getMonth()]} ${viewDate.getDate()}–${end.getDate()}, ${viewDate.getFullYear()}`
    }
    return `${MONTHS[viewDate.getMonth()].slice(0, 3)} ${viewDate.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`
  }, [view, year, month, viewDate])

  // Get days for current view
  const viewDays = useMemo(() => {
    if (view === "week") {
      const start = getWeekStart(viewDate)
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }
    if (view === "3day") {
      return Array.from({ length: 3 }, (_, i) => addDays(viewDate, i))
    }
    return []
  }, [view, viewDate])

  // Month view helpers
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDay = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1
  const selectedDayKey = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null
  const selectedDayEvents = selectedDayKey ? (dateEvents.get(selectedDayKey) ?? []) : []

  function openAdd(dayOrDate: number | Date) {
    const pad = (n: number) => String(n).padStart(2, "0")
    let dateStr: string
    if (dayOrDate instanceof Date) {
      dateStr = dateKey(dayOrDate)
    } else {
      dateStr = `${year}-${pad(month + 1)}-${pad(dayOrDate)}`
    }
    setAddDate(dateStr)
    setDialogMode("add")
    setEditingEventId(null)
    form.reset({ title: "", start_at: `${dateStr}T00:00`, all_day: true, description: "" })
    setDialogOpen(true)
  }

  function openEdit(id: string) {
    const event = events.find((e) => e.id === id)
    if (!event) return
    const dateStr = event.start_at.slice(0, 10)
    setAddDate(dateStr)
    setDialogMode("edit")
    setEditingEventId(id)
    const allDay = event.all_day ?? true
    form.reset({
      title: event.title,
      start_at: allDay ? `${dateStr}T00:00` : event.start_at.slice(0, 16),
      end_at: event.end_at ? event.end_at.slice(0, 16) : "",
      all_day: allDay,
      description: event.description ?? "",
    })
    setDialogOpen(true)
  }

  async function onSubmit(values: FormValues) {
    if (dialogMode === "edit" && editingEventId) {
      const { data, error } = await supabase
        .from("calendar_events")
        .update({
          title: values.title,
          start_at: values.all_day ? `${addDate}T00:00:00Z` : values.start_at,
          end_at: values.end_at || null,
          all_day: values.all_day,
          description: values.description || null,
        })
        .eq("id", editingEventId)
        .select()
        .single()
      if (error) { toast.error("Failed to update event"); return }
      setEvents((prev) => prev.map((e) => e.id === editingEventId ? data : e))
      toast.success("Event updated")
      setDialogOpen(false)
      return
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        user_id: userId,
        title: values.title,
        start_at: values.all_day ? `${addDate}T00:00:00Z` : values.start_at,
        end_at: values.end_at || null,
        all_day: values.all_day,
        description: values.description || null,
        source: "homebase",
      })
      .select()
      .single()

    if (error) { toast.error("Failed to add event"); return }
    setEvents((prev) => [...prev, data])
    toast.success("Event added")
    setDialogOpen(false)
  }

  async function onDelete() {
    if (!editingEventId) return
    setDeletingId(editingEventId)
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", editingEventId)
    setDeletingId(null)
    if (error) { toast.error("Failed to delete event"); return }
    setEvents((prev) => prev.filter((e) => e.id !== editingEventId))
    toast.success("Event deleted")
    setDialogOpen(false)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          {(asanaLoading || googleLoading) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Syncing
            </div>
          )}
        </div>
      </div>

      {/* View switcher + navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* View tabs */}
        <div className="flex rounded-lg border p-0.5 gap-0.5 w-fit">
          {([["month", "Month"], ["week", "Week"], ["3day", "3 Day"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => {
                setView(v)
                if (v !== "month") {
                  // When switching from month to week/3day, anchor viewDate to today or first of month
                  if (now.getFullYear() === year && now.getMonth() === month) {
                    setViewDate(now)
                  } else {
                    setViewDate(new Date(year, month, 1))
                  }
                }
              }}
              className={cn(
                "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2 flex-1 justify-between sm:justify-start">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="!size-8 !min-h-0">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(1)} className="!size-8 !min-h-0">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-sm sm:text-lg font-semibold">{navTitle}</span>
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs ml-auto sm:ml-2 h-7 !min-h-0">
            Today
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary inline-block" /> HomeBase</span>
        {hasAsana && <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500 inline-block" /> Asana</span>}
        {hasGoogle && <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500 inline-block" /> Google</span>}
        <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-orange-500 inline-block" /> Cleaning</span>
      </div>

      {/* ─── MONTH VIEW ─── */}
      {view === "month" && (
        <>
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-7 border-b">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="border-b border-r p-1 min-h-[64px] bg-muted/20" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const isToday = day === todayDay
                const isSelected = day === selectedDay
                const dayEvts = dateEvents.get(key) ?? []
                const col = (firstDayOfWeek + i) % 7

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    className={cn(
                      "border-b p-1 min-h-[64px] cursor-pointer transition-colors",
                      col < 6 && "border-r",
                      isSelected && "bg-primary/5",
                      !isSelected && "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "text-xs font-medium size-6 flex items-center justify-center rounded-full",
                          isToday && "bg-primary text-primary-foreground font-bold"
                        )}
                      >
                        {day}
                      </span>
                      {isSelected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openAdd(day) }}
                          className="size-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="size-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {dayEvts.slice(0, 3).map((evt, idx) => (
                        <span key={idx} className={cn("size-1.5 rounded-full shrink-0", TYPE_COLOR[evt.type])} />
                      ))}
                      {dayEvts.length > 3 && (
                        <span className="text-[9px] text-muted-foreground leading-none self-center">
                          +{dayEvts.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Selected day panel */}
          {selectedDay !== null && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {MONTHS[month]} {selectedDay}, {year}
                </h2>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openAdd(selectedDay)}>
                    <Plus className="size-3.5 mr-1" /> Add event
                  </Button>
                  <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => setSelectedDay(null)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((evt, idx) => (
                    <div key={idx} className="flex items-center gap-3 group">
                      <span className={cn("size-2 rounded-full shrink-0", TYPE_COLOR[evt.type])} />
                      <span className="text-sm flex-1">{evt.title}</span>
                      {!evt.allDay && evt.startHour != null && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTimeRange(evt)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs capitalize shrink-0">
                        {evt.type}
                      </Badge>
                      {evt.url && (
                        <a href={evt.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {evt.type === "homebase" && evt.id && (
                        <button
                          onClick={() => openEdit(evt.id!)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── WEEK / 3-DAY VIEW ─── */}
      {(view === "week" || view === "3day") && (
        <TimeGridView
          days={viewDays}
          dateEvents={dateEvents}
          todayKey={todayKey}
          timeGridRef={timeGridRef}
          onAddEvent={openAdd}
          onEditEvent={openEdit}
          view={view}
        />
      )}

      {/* ─── TASKS SECTION ─── */}
      <div className="border-t pt-4">
        <TasksContent embedded />
      </div>

      {/* Add / Edit event dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Doctor appointment" {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="all_day" className="size-4 rounded" {...form.register("all_day")} />
              <Label htmlFor="all_day" className="font-normal cursor-pointer">All day</Label>
            </div>

            {!form.watch("all_day") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input type="datetime-local" {...form.register("start_at")} />
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input type="datetime-local" {...form.register("end_at")} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input placeholder="Optional description" {...form.register("description")} />
            </div>

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              {dialogMode === "edit" && (
                <Button
                  type="button"
                  variant="destructive"
                  className="sm:mr-auto"
                  onClick={onDelete}
                  disabled={deletingId !== null}
                >
                  {deletingId ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  <span className="ml-1.5">Delete</span>
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving..."
                  : dialogMode === "edit" ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── TIME GRID VIEW (shared by Week & 3-Day) ────────────────────────────

interface TimeGridViewProps {
  days: Date[]
  dateEvents: Map<string, CalendarEntry[]>
  todayKey: string
  timeGridRef: React.RefObject<HTMLDivElement | null>
  onAddEvent: (d: Date) => void
  onEditEvent: (id: string) => void
  view: View
}

function TimeGridView({ days, dateEvents, todayKey, timeGridRef, onAddEvent, onEditEvent, view }: TimeGridViewProps) {
  const HOUR_HEIGHT = 60 // px per hour

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Day headers */}
      <div className={cn(
        "grid border-b",
        view === "week" ? "grid-cols-[56px_repeat(7,1fr)]" : "grid-cols-[56px_repeat(3,1fr)]"
      )}>
        <div className="border-r" /> {/* gutter */}
        {days.map((d) => {
          const key = dateKey(d)
          const isToday = key === todayKey
          return (
            <div
              key={key}
              className={cn(
                "py-2 text-center border-r last:border-r-0",
                isToday && "bg-primary/5"
              )}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                {view === "week" ? WEEKDAYS_SHORT[d.getDay()] : WEEKDAYS[d.getDay()]}
              </div>
              <div className={cn(
                "text-lg font-semibold leading-tight mx-auto size-8 flex items-center justify-center rounded-full",
                isToday && "bg-primary text-primary-foreground"
              )}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day events row */}
      {(() => {
        const hasAnyAllDay = days.some(d => {
          const evts = dateEvents.get(dateKey(d)) ?? []
          return evts.some(e => e.allDay)
        })
        if (!hasAnyAllDay) return null
        return (
          <div className={cn(
            "grid border-b",
            view === "week" ? "grid-cols-[56px_repeat(7,1fr)]" : "grid-cols-[56px_repeat(3,1fr)]"
          )}>
            <div className="border-r py-1 px-1 text-[10px] text-muted-foreground text-right">
              ALL
            </div>
            {days.map((d) => {
              const key = dateKey(d)
              const allDayEvts = (dateEvents.get(key) ?? []).filter(e => e.allDay)
              return (
                <div key={key} className="border-r last:border-r-0 p-1 min-h-[28px] space-y-0.5">
                  {allDayEvts.slice(0, 3).map((evt, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-[10px] leading-tight px-1.5 py-0.5 rounded truncate border-l-2",
                        TYPE_COLOR_BORDER[evt.type]
                      )}
                    >
                      {evt.url ? (
                        <a href={evt.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {evt.title}
                        </a>
                      ) : (
                        evt.title
                      )}
                    </div>
                  ))}
                  {allDayEvts.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{allDayEvts.length - 3} more</div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Time grid */}
      <div
        ref={timeGridRef}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 340px)" }}
      >
        <div className="relative">
          {/* Hour rows */}
          {GRID_HOURS.map((hour) => (
            <div
              key={hour}
              className={cn(
                "grid border-b",
                view === "week" ? "grid-cols-[56px_repeat(7,1fr)]" : "grid-cols-[56px_repeat(3,1fr)]"
              )}
              style={{ height: HOUR_HEIGHT }}
            >
              <div className="border-r text-[10px] text-muted-foreground text-right pr-2 -mt-2 leading-none">
                {formatHour(hour)}
              </div>
              {days.map((d) => {
                const key = dateKey(d)
                const isToday = key === todayKey
                return (
                  <div
                    key={key}
                    onClick={() => onAddEvent(d)}
                    className={cn(
                      "border-r last:border-r-0 cursor-pointer hover:bg-muted/20 transition-colors relative",
                      isToday && "bg-primary/[0.02]"
                    )}
                  />
                )
              })}
            </div>
          ))}

          {/* Timed events overlay */}
          <div
            className={cn(
              "absolute top-0 left-[56px] right-0 grid pointer-events-none",
              view === "week" ? "grid-cols-7" : "grid-cols-3"
            )}
          >
            {days.map((d) => {
              const key = dateKey(d)
              const timedEvts = (dateEvents.get(key) ?? []).filter(e => !e.allDay && e.startHour != null)

              return (
                <div key={key} className="relative">
                  {timedEvts.map((evt, i) => {
                    const startOffset = ((evt.startHour! - GRID_START_HOUR) + (evt.startMinute ?? 0) / 60) * HOUR_HEIGHT
                    let duration = HOUR_HEIGHT // default 1hr
                    if (evt.endHour != null) {
                      const endOffset = ((evt.endHour - GRID_START_HOUR) + (evt.endMinute ?? 0) / 60) * HOUR_HEIGHT
                      duration = Math.max(endOffset - startOffset, 20) // min 20px
                    }

                    return (
                      <div
                        key={i}
                        className={cn(
                          "absolute left-0.5 right-0.5 rounded border-l-2 px-1 py-0.5 overflow-hidden pointer-events-auto cursor-pointer",
                          TYPE_COLOR_BORDER[evt.type]
                        )}
                        style={{ top: startOffset, height: duration }}
                        title={`${evt.title}\n${formatTimeRange(evt)}`}
                        onClick={evt.type === "homebase" && evt.id ? () => onEditEvent(evt.id!) : undefined}
                      >
                        {evt.url ? (
                          <a
                            href={evt.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-[10px] font-medium leading-tight truncate">{evt.title}</div>
                            <div className="text-[9px] text-muted-foreground leading-tight">{formatTimeRange(evt)}</div>
                          </a>
                        ) : (
                          <>
                            <div className="text-[10px] font-medium leading-tight truncate">{evt.title}</div>
                            <div className="text-[9px] text-muted-foreground leading-tight">{formatTimeRange(evt)}</div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Current time indicator */}
          {days.some(d => dateKey(d) === todayKey) && (() => {
            const now = new Date()
            const currentHour = now.getHours()
            const currentMinute = now.getMinutes()
            if (currentHour < GRID_START_HOUR || currentHour > GRID_END_HOUR) return null
            const top = ((currentHour - GRID_START_HOUR) + currentMinute / 60) * HOUR_HEIGHT
            const todayIdx = days.findIndex(d => dateKey(d) === todayKey)

            return (
              <div
                className="absolute left-[56px] right-0 pointer-events-none"
                style={{ top }}
              >
                <div
                  className={cn(
                    "absolute h-0.5 bg-red-500",
                    view === "week"
                      ? "left-[calc(var(--idx)*100%/7)] w-[calc(100%/7)]"
                      : "left-[calc(var(--idx)*100%/3)] w-[calc(100%/3)]"
                  )}
                  style={{ "--idx": todayIdx } as React.CSSProperties}
                >
                  <div className="absolute -left-1 -top-1 size-2.5 rounded-full bg-red-500" />
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
