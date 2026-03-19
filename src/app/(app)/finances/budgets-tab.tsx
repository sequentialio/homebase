"use client"

import { useState, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { EXPENSE_CATEGORIES } from "./constants"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronRight,
  MoreHorizontal, FolderPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Tables } from "@/types/database"

type Budget = Tables<"budgets">
type BudgetSection = Tables<"budget_sections">
type Transaction = Tables<"transactions">

interface SectionState extends BudgetSection {
  budgets: Budget[]
  collapsed: boolean
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const budgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  monthly_limit: z.number().positive("Limit must be greater than 0"),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  section_id: z.string().nullable(),
})
type FormValues = z.infer<typeof budgetSchema>

interface BudgetsTabProps {
  userId: string
  initialBudgets: Budget[]
  initialSections: BudgetSection[]
  transactions: Transaction[]
}

function buildSections(
  rawSections: BudgetSection[],
  rawBudgets: Budget[],
): SectionState[] {
  const sorted = [...rawSections].sort((a, b) => a.position - b.position)
  return sorted.map((sec) => ({
    ...sec,
    collapsed: false,
    budgets: rawBudgets
      .filter((b) => b.section_id === sec.id)
      .sort((a, b) => a.position - b.position),
  }))
}

// ── Sortable budget row ──────────────────────────────────────────────────────

interface SortableBudgetRowProps {
  budget: Budget
  spent: number
  onEdit: (b: Budget) => void
  onDelete: (id: string) => void
  deleting: string | null
}

function SortableBudgetRow({ budget, spent, onEdit, onDelete, deleting }: SortableBudgetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: budget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const limit = Number(budget.monthly_limit)
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const over = spent > limit

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border p-4 space-y-2 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          >
            <GripVertical className="size-4" />
          </button>
          <span className="font-medium text-sm">{budget.category}</span>
          {over && (
            <span className="text-xs text-destructive font-medium">Over budget</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {formatCurrency(spent)} / {formatCurrency(limit)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="!size-7 !min-h-0"
            onClick={() => onEdit(budget)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="!size-7 !min-h-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(budget.id)}
            disabled={deleting === budget.id}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {formatCurrency(Math.max(limit - spent, 0))} remaining
      </p>
    </div>
  )
}

// ── Section block ────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: SectionState
  spendingByCategory: Record<string, number>
  viewMonth: number
  viewYear: number
  deleting: string | null
  onToggleCollapse: (id: string) => void
  onRename: (id: string, name: string) => void
  onAddBudget: (sectionId: string) => void
  onDeleteSection: (id: string) => void
  onEdit: (b: Budget) => void
  onDelete: (id: string) => void
}

function SectionBlock({
  section,
  spendingByCategory,
  viewMonth,
  viewYear,
  deleting,
  onToggleCollapse,
  onRename,
  onAddBudget,
  onDeleteSection,
  onEdit,
  onDelete,
}: SectionBlockProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(section.name)

  const monthBudgets = section.budgets.filter(
    (b) => b.month === viewMonth && b.year === viewYear
  )
  const sectionTotal = monthBudgets.reduce((sum, b) => sum + Number(b.monthly_limit), 0)

  function commitRename() {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== section.name) {
      onRename(section.id, trimmed)
    } else {
      setNameValue(section.name)
    }
    setEditingName(false)
  }

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center gap-1 group">
        <button
          onClick={() => onToggleCollapse(section.id)}
          className="text-muted-foreground hover:text-foreground"
        >
          {section.collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>

        {editingName ? (
          <Input
            className="h-6 text-sm font-semibold px-1 py-0 w-40"
            value={nameValue}
            autoFocus
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") { setNameValue(section.name); setEditingName(false) }
            }}
          />
        ) : (
          <button
            className="text-sm font-semibold hover:underline"
            onDoubleClick={() => setEditingName(true)}
          >
            {section.name}
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-1">
          {monthBudgets.length} · {formatCurrency(sectionTotal)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="!size-6 !min-h-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditingName(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddBudget(section.id)}>Add Budget</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDeleteSection(section.id)}
            >
              Delete Section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Budget rows */}
      {!section.collapsed && (
        <SortableContext
          items={monthBudgets.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 pl-5">
            {monthBudgets.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                No budgets for {MONTHS[viewMonth - 1]} {viewYear} — add one
              </div>
            ) : (
              monthBudgets.map((b) => (
                <SortableBudgetRow
                  key={b.id}
                  budget={b}
                  spent={spendingByCategory[b.category] ?? 0}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  deleting={deleting}
                />
              ))
            )}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function BudgetsTab({
  userId,
  initialBudgets,
  initialSections,
  transactions,
}: BudgetsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [sections, setSections] = useState<SectionState[]>(() =>
    buildSections(initialSections, initialBudgets)
  )
  const [unsectioned, setUnsectioned] = useState<Budget[]>(() =>
    initialBudgets
      .filter((b) => !b.section_id)
      .sort((a, b) => a.position - b.position)
  )
  const sectionsRef = useRef(sections)
  const unsectionedRef = useRef(unsectioned)
  sectionsRef.current = sections
  unsectionedRef.current = unsectioned

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null)

  const [activeId, setActiveId] = useState<string | null>(null)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear, setViewYear] = useState(now.getFullYear())

  const spendingByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach((t) => {
      if (t.type !== "expense" || !t.category || !t.date) return
      const [y, m] = t.date.split("-").map(Number)
      if (y === viewYear && m === viewMonth) {
        map[t.category] = (map[t.category] ?? 0) + Number(t.amount)
      }
    })
    return map
  }, [transactions, viewMonth, viewYear])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i + 1)

  // Find which container owns a budget id
  function findContainer(id: string): string {
    for (const sec of sectionsRef.current) {
      if (sec.id === id) return id
      if (sec.budgets.find((b) => b.id === id)) return sec.id
    }
    if (id === "unsectioned") return "unsectioned"
    if (unsectionedRef.current.find((b) => b.id === id)) return "unsectioned"
    return ""
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(String(active.id))
    const overContainer = findContainer(String(over.id))

    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    const getBudget = (containerId: string, budgetId: string): Budget | undefined => {
      if (containerId === "unsectioned") {
        return unsectionedRef.current.find((b) => b.id === budgetId)
      }
      return sectionsRef.current.find((s) => s.id === containerId)?.budgets.find((b) => b.id === budgetId)
    }

    const activeBudget = getBudget(activeContainer, String(active.id))
    if (!activeBudget) return

    if (overContainer === "unsectioned") {
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeContainer
            ? { ...s, budgets: s.budgets.filter((b) => b.id !== active.id) }
            : s
        )
      )
      setUnsectioned((prev) => [...prev, { ...activeBudget, section_id: null }])
    } else if (activeContainer === "unsectioned") {
      setUnsectioned((prev) => prev.filter((b) => b.id !== active.id))
      setSections((prev) =>
        prev.map((s) =>
          s.id === overContainer
            ? { ...s, budgets: [...s.budgets, { ...activeBudget, section_id: overContainer }] }
            : s
        )
      )
    } else {
      // section → section
      setSections((prev) => {
        const fromSec = prev.find((s) => s.id === activeContainer)
        if (!fromSec) return prev
        return prev.map((s) => {
          if (s.id === activeContainer) {
            return { ...s, budgets: s.budgets.filter((b) => b.id !== active.id) }
          }
          if (s.id === overContainer) {
            return { ...s, budgets: [...s.budgets, { ...activeBudget, section_id: overContainer }] }
          }
          return s
        })
      })
    }
  }

  async function persistPositions(containerId: string, budgets: Budget[]) {
    const results = await Promise.all(
      budgets.map((b, i) =>
        supabase.from("budgets").update({ position: i, section_id: b.section_id }).eq("id", b.id)
      )
    )
    if (results.some((r) => r.error)) toast.error("Failed to save order")
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeContainer = findContainer(String(active.id))
    const overContainer = findContainer(String(over.id))
    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      if (activeContainer === "unsectioned") {
        const oldIdx = unsectionedRef.current.findIndex((b) => b.id === active.id)
        const newIdx = unsectionedRef.current.findIndex((b) => b.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(unsectionedRef.current, oldIdx, newIdx)
          setUnsectioned(reordered)
          await persistPositions("unsectioned", reordered)
        }
      } else {
        const sec = sectionsRef.current.find((s) => s.id === activeContainer)
        if (!sec) return
        const oldIdx = sec.budgets.findIndex((b) => b.id === active.id)
        const newIdx = sec.budgets.findIndex((b) => b.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(sec.budgets, oldIdx, newIdx)
          setSections((prev) => prev.map((s) => s.id === activeContainer ? { ...s, budgets: reordered } : s))
          await persistPositions(activeContainer, reordered)
        }
      }
    } else {
      const newSectionId = overContainer === "unsectioned" ? null : overContainer
      await supabase.from("budgets").update({ section_id: newSectionId }).eq("id", String(active.id))
      if (overContainer === "unsectioned") {
        await persistPositions("unsectioned", unsectionedRef.current)
      } else {
        const destSec = sectionsRef.current.find((s) => s.id === overContainer)
        if (destSec) await persistPositions(overContainer, destSec.budgets)
      }
    }
  }

  // Active budget for DragOverlay
  const activeBudget = useMemo(() => {
    if (!activeId) return null
    for (const sec of sections) {
      const found = sec.budgets.find((b) => b.id === activeId)
      if (found) return found
    }
    return unsectioned.find((b) => b.id === activeId) ?? null
  }, [activeId, sections, unsectioned])

  const form = useForm<FormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: "",
      monthly_limit: 0,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      section_id: null,
    },
  })

  function openAdd(sectionId?: string) {
    form.reset({
      category: "",
      monthly_limit: 0,
      month: viewMonth,
      year: viewYear,
      section_id: sectionId ?? null,
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(b: Budget) {
    form.reset({
      category: b.category,
      monthly_limit: Number(b.monthly_limit),
      month: b.month,
      year: b.year,
      section_id: b.section_id ?? null,
    })
    setEditing(b)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      category: values.category,
      monthly_limit: values.monthly_limit,
      month: values.month,
      year: values.year,
      section_id: values.section_id,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("budgets")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update budget"); return }

      const updated = data
      if (updated.section_id) {
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            budgets: s.id === updated.section_id
              ? s.budgets.map((b) => (b.id === editing.id ? updated : b))
              : s.budgets.filter((b) => b.id !== editing.id),
          }))
        )
        setUnsectioned((prev) => prev.filter((b) => b.id !== editing.id))
      } else {
        setSections((prev) =>
          prev.map((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== editing.id) }))
        )
        setUnsectioned((prev) => prev.map((b) => (b.id === editing.id ? updated : b)))
      }
      toast.success("Budget updated")
    } else {
      const position = payload.section_id
        ? (sections.find((s) => s.id === payload.section_id)?.budgets.length ?? 0)
        : unsectioned.length
      const { data, error } = await supabase
        .from("budgets")
        .insert({ ...payload, position, user_id: userId })
        .select()
        .single()
      if (error) { toast.error("Failed to add budget"); return }

      if (data.section_id) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === data.section_id ? { ...s, budgets: [...s.budgets, data] } : s
          )
        )
      } else {
        setUnsectioned((prev) => [...prev, data])
      }
      toast.success("Budget added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("budgets").delete().eq("id", id)
    if (error) { toast.error("Failed to delete budget"); setDeleting(null); return }
    setSections((prev) =>
      prev.map((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) }))
    )
    setUnsectioned((prev) => prev.filter((b) => b.id !== id))
    toast.success("Budget deleted")
    setDeleting(null)
  }

  async function handleRenameSection(id: string, name: string) {
    const { error } = await supabase.from("budget_sections").update({ name }).eq("id", id)
    if (error) { toast.error("Failed to rename section"); return }
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  async function handleDeleteSection(id: string) {
    const { error } = await supabase.from("budget_sections").delete().eq("id", id)
    if (error) { toast.error("Failed to delete section"); return }
    const orphans = sections.find((s) => s.id === id)?.budgets ?? []
    setSections((prev) => prev.filter((s) => s.id !== id))
    setUnsectioned((prev) => [...prev, ...orphans.map((b) => ({ ...b, section_id: null }))])
    setDeleteSectionId(null)
    toast.success("Section deleted")
  }

  async function handleCreateSection() {
    const name = newSectionName.trim()
    if (!name) return
    const position = sections.length
    const { data, error } = await supabase
      .from("budget_sections")
      .insert({ name, position, user_id: userId })
      .select()
      .single()
    if (error) { toast.error("Failed to create section"); return }
    setSections((prev) => [...prev, { ...data, budgets: [], collapsed: false }])
    setNewSectionName("")
    setNewSectionOpen(false)
    toast.success("Section created")
  }

  function toggleCollapse(id: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s))
    )
  }

  const unsectionedMonth = unsectioned.filter(
    (b) => b.month === viewMonth && b.year === viewYear
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Select value={String(viewMonth)} onValueChange={(v) => setViewMonth(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setNewSectionOpen(true)}>
            <FolderPlus className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">New Section</span>
          </Button>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="size-4 mr-1" /> Add Budget
          </Button>
        </div>
      </div>

      {/* DnD context */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-6">
          {/* Sections */}
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              spendingByCategory={spendingByCategory}
              viewMonth={viewMonth}
              viewYear={viewYear}
              deleting={deleting}
              onToggleCollapse={toggleCollapse}
              onRename={handleRenameSection}
              onAddBudget={(sId) => openAdd(sId)}
              onDeleteSection={(id) => setDeleteSectionId(id)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Unsectioned */}
          {(unsectionedMonth.length > 0 || sections.length === 0) && (
            <div className="space-y-2">
              {sections.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  No Section
                </p>
              )}
              <SortableContext
                items={unsectionedMonth.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {unsectionedMonth.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                      No budgets for {MONTHS[viewMonth - 1]} {viewYear}
                    </div>
                  ) : (
                    unsectionedMonth.map((b) => (
                      <SortableBudgetRow
                        key={b.id}
                        budget={b}
                        spent={spendingByCategory[b.category] ?? 0}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        deleting={deleting}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeBudget && (
            <div className="rounded-lg border p-4 bg-card shadow-lg opacity-95 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">{activeBudget.category}</span>
              </div>
              <div className="h-2 rounded-full bg-muted" />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add/Edit budget dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Budget" : "Add Budget"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.category && (
                <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Limit ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register("monthly_limit", { valueAsNumber: true })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select
                  value={String(form.watch("month"))}
                  onValueChange={(v) => form.setValue("month", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input
                  type="number"
                  placeholder="2026"
                  {...form.register("year", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select
                value={form.watch("section_id") ?? "none"}
                onValueChange={(v) => form.setValue("section_id", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No section</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* New section dialog */}
      <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>New Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              placeholder="e.g. Fixed Expenses"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateSection() }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSectionOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSection} disabled={!newSectionName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete section confirm */}
      <Dialog open={!!deleteSectionId} onOpenChange={() => setDeleteSectionId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Budgets in this section will be moved to &ldquo;No Section&rdquo;.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSectionId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteSectionId && handleDeleteSection(deleteSectionId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
