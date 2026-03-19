"use client"

import { useState, useMemo, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { EXPENSE_CATEGORIES, EXPENSE_FREQUENCIES } from "./constants"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, GripVertical,
  ChevronDown, ChevronRight, MoreHorizontal, FolderPlus,
  Zap, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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

type RecurringExpense = Tables<"recurring_expenses">
type ExpenseSection = Tables<"expense_sections">
type BankAccount = Tables<"bank_accounts">

interface SectionState extends ExpenseSection {
  expenses: RecurringExpense[]
  collapsed: boolean
}

const expenseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().min(0),
  category: z.string().nullable(),
  account_id: z.string().nullable(),
  frequency: z.string().min(1),
  billing_day: z.string().optional(),
  auto_pay: z.boolean(),
  active: z.boolean(),
  notes: z.string().optional(),
  section_id: z.string().nullable(),
})
type FormValues = z.infer<typeof expenseSchema>

interface ExpensesTabProps {
  userId: string
  initialExpenses: RecurringExpense[]
  initialSections: ExpenseSection[]
  accounts: BankAccount[]
}

// ── Category combobox (type-ahead + presets) ──────────────────────────────

function CategoryCombobox({
  value,
  onChange,
  existingCategories,
}: {
  value: string
  onChange: (v: string) => void
  existingCategories: string[]
}) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Merge preset + user-created categories, dedupe, sort
  const allCategories = useMemo(() => {
    const set = new Set([...(EXPENSE_CATEGORIES as unknown as string[]), ...existingCategories])
    return [...set].sort()
  }, [existingCategories])

  const filtered = useMemo(() => {
    if (!inputValue) return allCategories
    const q = inputValue.toLowerCase()
    return allCategories.filter((c) => c.toLowerCase().includes(q))
  }, [inputValue, allCategories])

  const handleSelect = useCallback((cat: string) => {
    setInputValue(cat)
    onChange(cat)
    setOpen(false)
  }, [onChange])

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={inputValue}
        placeholder="Type or select..."
        onChange={(e) => {
          setInputValue(e.target.value)
          onChange(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so click on dropdown item registers first
          setTimeout(() => setOpen(false), 150)
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((cat) => (
            <button
              key={cat}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function buildSections(
  rawSections: ExpenseSection[],
  rawExpenses: RecurringExpense[],
): SectionState[] {
  const sorted = [...rawSections].sort((a, b) => a.position - b.position)
  return sorted.map((sec) => ({
    ...sec,
    collapsed: false,
    expenses: rawExpenses
      .filter((e) => e.section_id === sec.id)
      .sort((a, b) => a.position - b.position),
  }))
}

function ordinalDay(day: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = day % 100
  return day + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function frequencyLabel(f: string): string {
  const map: Record<string, string> = {
    weekly: "Weekly",
    biweekly: "Biweekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annually: "Annually",
  }
  return map[f] ?? f
}

// Monthly equivalent for summary
function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly": return amount * 52 / 12
    case "biweekly": return amount * 26 / 12
    case "monthly": return amount
    case "quarterly": return amount / 3
    case "annually": return amount / 12
    default: return amount
  }
}

// ── Sortable expense row ─────────────────────────────────────────────────────

interface SortableExpenseRowProps {
  expense: RecurringExpense
  accounts: BankAccount[]
  onEdit: (e: RecurringExpense) => void
  onDelete: (id: string) => void
  deleting: string | null
}

function SortableExpenseRow({
  expense,
  accounts,
  onEdit,
  onDelete,
  deleting,
}: SortableExpenseRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: expense.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const account = accounts.find((a) => a.id === expense.account_id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-4 bg-card ${!expense.active ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none mt-0.5 shrink-0"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-medium text-sm truncate">{expense.name}</span>
              {!expense.active && (
                <Badge variant="secondary" className="text-xs shrink-0">Inactive</Badge>
              )}
              {expense.auto_pay && (
                <Badge variant="outline" className="text-xs gap-1 shrink-0">
                  <Zap className="size-2.5" />
                  Auto-pay
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="font-semibold text-sm">{formatCurrency(Number(expense.amount))}</span>
              <Button
                variant="ghost"
                size="icon"
                className="!size-7 !min-h-0"
                onClick={() => onEdit(expense)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(expense.id)}
                disabled={deleting === expense.id}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <RefreshCw className="size-3" />
              {frequencyLabel(expense.frequency)}
            </span>
            {expense.billing_day != null && (
              <span>Posts {ordinalDay(expense.billing_day)}</span>
            )}
            {account && (
              <span className="truncate max-w-[160px]">{account.name}</span>
            )}
            {expense.category && (
              <span className="text-muted-foreground/70">{expense.category}</span>
            )}
          </div>

          {expense.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 border-t pt-1.5">{expense.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section block ────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: SectionState
  accounts: BankAccount[]
  deleting: string | null
  onToggleCollapse: (id: string) => void
  onRename: (id: string, name: string) => void
  onAddExpense: (sectionId: string) => void
  onDeleteSection: (id: string) => void
  onEdit: (e: RecurringExpense) => void
  onDelete: (id: string) => void
}

function SectionBlock({
  section,
  accounts,
  deleting,
  onToggleCollapse,
  onRename,
  onAddExpense,
  onDeleteSection,
  onEdit,
  onDelete,
}: SectionBlockProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(section.name)

  const monthlyTotal = section.expenses
    .filter((e) => e.active)
    .reduce((sum, e) => sum + toMonthlyAmount(Number(e.amount), e.frequency), 0)

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
          {section.expenses.length} · {formatCurrency(monthlyTotal)}/mo
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
            <DropdownMenuItem onClick={() => onAddExpense(section.id)}>Add Expense</DropdownMenuItem>
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

      {!section.collapsed && (
        <SortableContext
          items={section.expenses.map((e) => e.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 pl-5">
            {section.expenses.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                No expenses in this section — add one
              </div>
            ) : (
              section.expenses.map((e) => (
                <SortableExpenseRow
                  key={e.id}
                  expense={e}
                  accounts={accounts}
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

export function ExpensesTab({
  userId,
  initialExpenses,
  initialSections,
  accounts,
}: ExpensesTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [sections, setSections] = useState<SectionState[]>(() =>
    buildSections(initialSections, initialExpenses)
  )
  const [unsectioned, setUnsectioned] = useState<RecurringExpense[]>(() =>
    initialExpenses
      .filter((e) => !e.section_id)
      .sort((a, b) => a.position - b.position)
  )
  const sectionsRef = useRef(sections)
  const unsectionedRef = useRef(unsectioned)
  sectionsRef.current = sections
  unsectionedRef.current = unsectioned

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringExpense | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const dragOriginContainer = useRef<string>("")
  // Tracks where the item currently IS (updated synchronously in handleDragOver
  // before setSections, so subsequent handleDragOver calls never read stale position)
  const activeCurContainer = useRef<string>("")

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const monthlyTotal = useMemo(() => {
    const all = [...sections.flatMap((s) => s.expenses), ...unsectioned]
    return all
      .filter((e) => e.active)
      .reduce((sum, e) => sum + toMonthlyAmount(Number(e.amount), e.frequency), 0)
  }, [sections, unsectioned])

  const annualTotal = monthlyTotal * 12

  // Collect all unique categories from existing expenses (for combobox suggestions)
  const existingCategories = useMemo(() => {
    const all = [...sections.flatMap((s) => s.expenses), ...unsectioned]
    const cats = new Set(all.map((e) => e.category).filter(Boolean) as string[])
    return [...cats].sort()
  }, [sections, unsectioned])

  function findContainer(id: string): string {
    for (const sec of sectionsRef.current) {
      if (sec.id === id) return id
      if (sec.expenses.find((e) => e.id === id)) return sec.id
    }
    if (id === "unsectioned") return "unsectioned"
    if (unsectionedRef.current.find((e) => e.id === id)) return "unsectioned"
    return ""
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveId(id)
    const container = findContainer(id)
    dragOriginContainer.current = container
    activeCurContainer.current = container
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    // Use activeCurContainer (updated synchronously) instead of findContainer(active.id)
    // which reads from sectionsRef and can be stale between setState and re-render,
    // causing duplicate items to be added on rapid pointer moves.
    const activeContainer = activeCurContainer.current
    const overContainer = findContainer(String(over.id))
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    const getExpense = (containerId: string, expId: string): RecurringExpense | undefined => {
      if (containerId === "unsectioned") return unsectionedRef.current.find((e) => e.id === expId)
      return sectionsRef.current.find((s) => s.id === containerId)?.expenses.find((e) => e.id === expId)
    }

    const activeExp = getExpense(activeContainer, String(active.id))
    if (!activeExp) return

    // Update current container BEFORE setSections so the next handleDragOver
    // call sees the correct position immediately (not stale sectionsRef)
    activeCurContainer.current = overContainer

    if (overContainer === "unsectioned") {
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeContainer ? { ...s, expenses: s.expenses.filter((e) => e.id !== active.id) } : s
        )
      )
      setUnsectioned((prev) => [...prev, { ...activeExp, section_id: null }])
    } else if (activeContainer === "unsectioned") {
      setUnsectioned((prev) => prev.filter((e) => e.id !== active.id))
      setSections((prev) =>
        prev.map((s) =>
          s.id === overContainer
            ? { ...s, expenses: [...s.expenses, { ...activeExp, section_id: overContainer }] }
            : s
        )
      )
    } else {
      setSections((prev) =>
        prev.map((s) => {
          if (s.id === activeContainer) return { ...s, expenses: s.expenses.filter((e) => e.id !== active.id) }
          if (s.id === overContainer) return { ...s, expenses: [...s.expenses, { ...activeExp, section_id: overContainer }] }
          return s
        })
      )
    }
  }

  async function persistPositions(containerId: string, expenses: RecurringExpense[]) {
    const results = await Promise.all(
      expenses.map((e, i) =>
        supabase.from("recurring_expenses").update({ position: i, section_id: e.section_id }).eq("id", e.id)
      )
    )
    if (results.some((r) => r.error)) toast.error("Failed to save order")
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    // Use the origin container captured at dragStart — by now handleDragOver has
    // already moved the item visually, so findContainer(active.id) would return
    // the destination, making activeContainer === overContainer for all cross-section drops.
    const activeContainer = dragOriginContainer.current || findContainer(String(active.id))
    const overContainer = findContainer(String(over.id))
    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      // Same-section reorder
      if (activeContainer === "unsectioned") {
        const oldIdx = unsectionedRef.current.findIndex((e) => e.id === active.id)
        const newIdx = unsectionedRef.current.findIndex((e) => e.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(unsectionedRef.current, oldIdx, newIdx)
          setUnsectioned(reordered)
          await persistPositions("unsectioned", reordered)
        }
      } else {
        const sec = sectionsRef.current.find((s) => s.id === activeContainer)
        if (!sec) return
        const oldIdx = sec.expenses.findIndex((e) => e.id === active.id)
        const newIdx = sec.expenses.findIndex((e) => e.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(sec.expenses, oldIdx, newIdx)
          setSections((prev) => prev.map((s) => s.id === activeContainer ? { ...s, expenses: reordered } : s))
          await persistPositions(activeContainer, reordered)
        }
      }
    } else {
      // Cross-section move — handleDragOver already updated visual state.
      // Persist section_id change + renumber positions in both source and destination.
      const newSectionId = overContainer === "unsectioned" ? null : overContainer
      await supabase.from("recurring_expenses").update({ section_id: newSectionId }).eq("id", String(active.id))

      // Persist destination
      if (overContainer === "unsectioned") {
        await persistPositions("unsectioned", unsectionedRef.current)
      } else {
        const destSec = sectionsRef.current.find((s) => s.id === overContainer)
        if (destSec) await persistPositions(overContainer, destSec.expenses)
      }

      // Persist source (renumber positions after removal)
      if (activeContainer === "unsectioned") {
        await persistPositions("unsectioned", unsectionedRef.current)
      } else {
        const srcSec = sectionsRef.current.find((s) => s.id === activeContainer)
        if (srcSec) await persistPositions(activeContainer, srcSec.expenses)
      }
    }
  }

  const activeExpense = useMemo(() => {
    if (!activeId) return null
    for (const sec of sections) {
      const found = sec.expenses.find((e) => e.id === activeId)
      if (found) return found
    }
    return unsectioned.find((e) => e.id === activeId) ?? null
  }, [activeId, sections, unsectioned])

  const form = useForm<FormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: "",
      amount: 0,
      category: null,
      account_id: null,
      frequency: "monthly",
      billing_day: "",
      auto_pay: false,
      active: true,
      notes: "",
      section_id: null,
    },
  })

  function openAdd(sectionId?: string) {
    form.reset({
      name: "",
      amount: 0,
      category: null,
      account_id: null,
      frequency: "monthly",
      billing_day: "",
      auto_pay: false,
      active: true,
      notes: "",
      section_id: sectionId ?? null,
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(e: RecurringExpense) {
    form.reset({
      name: e.name,
      amount: Number(e.amount),
      category: e.category ?? null,
      account_id: e.account_id ?? null,
      frequency: e.frequency,
      billing_day: e.billing_day != null ? String(e.billing_day) : "",
      auto_pay: e.auto_pay,
      active: e.active,
      notes: e.notes ?? "",
      section_id: e.section_id ?? null,
    })
    setEditing(e)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      amount: values.amount,
      category: values.category || null,
      account_id: values.account_id || null,
      frequency: values.frequency,
      billing_day: values.billing_day ? parseInt(values.billing_day) : null,
      auto_pay: values.auto_pay,
      active: values.active,
      notes: values.notes || null,
      section_id: values.section_id,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("recurring_expenses")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update expense"); return }
      const updated = data
      if (updated.section_id) {
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            expenses: s.id === updated.section_id
              ? s.expenses.map((e) => (e.id === editing.id ? updated : e))
              : s.expenses.filter((e) => e.id !== editing.id),
          }))
        )
        setUnsectioned((prev) => prev.filter((e) => e.id !== editing.id))
      } else {
        setSections((prev) =>
          prev.map((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== editing.id) }))
        )
        setUnsectioned((prev) => prev.map((e) => (e.id === editing.id ? updated : e)))
      }
      toast.success("Expense updated")
    } else {
      const position = payload.section_id
        ? (sections.find((s) => s.id === payload.section_id)?.expenses.length ?? 0)
        : unsectioned.length
      const { data, error } = await supabase
        .from("recurring_expenses")
        .insert({ ...payload, position, user_id: userId })
        .select()
        .single()
      if (error) { toast.error("Failed to add expense"); return }
      if (data.section_id) {
        setSections((prev) =>
          prev.map((s) => s.id === data.section_id ? { ...s, expenses: [...s.expenses, data] } : s)
        )
      } else {
        setUnsectioned((prev) => [...prev, data])
      }
      toast.success("Expense added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id)
    if (error) { toast.error("Failed to delete expense"); setDeleting(null); return }
    setSections((prev) =>
      prev.map((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }))
    )
    setUnsectioned((prev) => prev.filter((e) => e.id !== id))
    toast.success("Expense deleted")
    setDeleting(null)
  }

  async function handleRenameSection(id: string, name: string) {
    const { error } = await supabase.from("expense_sections").update({ name }).eq("id", id)
    if (error) { toast.error("Failed to rename section"); return }
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  async function handleDeleteSection(id: string) {
    const { error } = await supabase.from("expense_sections").delete().eq("id", id)
    if (error) { toast.error("Failed to delete section"); return }
    const orphans = sections.find((s) => s.id === id)?.expenses ?? []
    setSections((prev) => prev.filter((s) => s.id !== id))
    setUnsectioned((prev) => [...prev, ...orphans.map((e) => ({ ...e, section_id: null }))])
    setDeleteSectionId(null)
    toast.success("Section deleted")
  }

  async function handleCreateSection() {
    const name = newSectionName.trim()
    if (!name) return
    const position = sections.length
    const { data, error } = await supabase
      .from("expense_sections")
      .insert({ name, position, user_id: userId })
      .select()
      .single()
    if (error) { toast.error("Failed to create section"); return }
    setSections((prev) => [...prev, { ...data, expenses: [], collapsed: false }])
    setNewSectionName("")
    setNewSectionOpen(false)
    toast.success("Section created")
  }

  function toggleCollapse(id: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s)))
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Monthly</p>
            <p className="text-xl font-bold">{formatCurrency(monthlyTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Annual</p>
            <p className="text-xl font-bold">{formatCurrency(annualTotal)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setNewSectionOpen(true)}>
            <FolderPlus className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">New Section</span>
          </Button>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="size-4 mr-1" /> Add Expense
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
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              accounts={accounts}
              deleting={deleting}
              onToggleCollapse={toggleCollapse}
              onRename={handleRenameSection}
              onAddExpense={(sId) => openAdd(sId)}
              onDeleteSection={(id) => setDeleteSectionId(id)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Unsectioned */}
          {(unsectioned.length > 0 || sections.length === 0) && (
            <div className="space-y-2">
              {sections.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  No Section
                </p>
              )}
              <SortableContext
                items={unsectioned.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {unsectioned.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                      No recurring expenses — add one
                    </div>
                  ) : (
                    unsectioned.map((e) => (
                      <SortableExpenseRow
                        key={e.id}
                        expense={e}
                        accounts={accounts}
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
          {activeExpense && (
            <div className="rounded-lg border p-3 bg-card shadow-lg opacity-95 flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground" />
              <span className="font-medium text-sm">{activeExpense.name}</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {formatCurrency(Number(activeExpense.amount))}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Netflix, Rent, SCFCU Loan" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register("amount", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  value={form.watch("frequency")}
                  onValueChange={(v) => form.setValue("frequency", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>{frequencyLabel(f)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <CategoryCombobox
                  value={form.watch("category") ?? ""}
                  onChange={(v) => form.setValue("category", v || null)}
                  existingCategories={existingCategories}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Day</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g. 1, 15"
                  {...form.register("billing_day")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select
                value={form.watch("account_id") ?? "none"}
                onValueChange={(v) => form.setValue("account_id", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="auto_pay"
                  checked={form.watch("auto_pay")}
                  onCheckedChange={(v) => form.setValue("auto_pay", v)}
                />
                <Label htmlFor="auto_pay" className="cursor-pointer">Auto-pay</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="active"
                  checked={form.watch("active")}
                  onCheckedChange={(v) => form.setValue("active", v)}
                />
                <Label htmlFor="active" className="cursor-pointer">Active</Label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Any notes..." rows={2} {...form.register("notes")} />
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
              placeholder="e.g. Housing, Subscriptions"
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
            Expenses in this section will be moved to &ldquo;No Section&rdquo;.
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
