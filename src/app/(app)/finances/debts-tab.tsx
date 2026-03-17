"use client"

import { useState, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, CreditCard, GripVertical,
  ChevronDown, ChevronRight, MoreHorizontal, FolderPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

type Debt = Tables<"debts">
type DebtSection = Tables<"debt_sections">

interface SectionState extends DebtSection {
  debts: Debt[]
  collapsed: boolean
}

const debtSchema = z.object({
  name: z.string().min(1, "Name is required"),
  balance: z.number().min(0),
  interest_rate: z.string().optional(),
  min_payment: z.string().optional(),
  payoff_date: z.string().optional(),
  notes: z.string().optional(),
  section_id: z.string().nullable(),
})
type FormValues = z.infer<typeof debtSchema>

interface DebtsTabProps {
  userId: string
  initialDebts: Debt[]
  initialSections: DebtSection[]
}

function buildSections(rawSections: DebtSection[], rawDebts: Debt[]): SectionState[] {
  const sorted = [...rawSections].sort((a, b) => a.position - b.position)
  return sorted.map((sec) => ({
    ...sec,
    collapsed: false,
    debts: rawDebts
      .filter((d) => d.section_id === sec.id)
      .sort((a, b) => a.position - b.position),
  }))
}

// ── Sortable debt card ───────────────────────────────────────────────────────

interface SortableDebtCardProps {
  debt: Debt
  onEdit: (d: Debt) => void
  onDelete: (id: string) => void
  deleting: string | null
}

function SortableDebtCard({ debt, onEdit, onDelete, deleting }: SortableDebtCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: debt.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none mt-0.5"
          >
            <GripVertical className="size-4" />
          </button>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <CreditCard className="size-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{debt.name}</p>
            <p className="text-lg font-bold text-destructive mt-0.5">
              {formatCurrency(Number(debt.balance))}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => onEdit(debt)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="!size-7 !min-h-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(debt.id)}
            disabled={deleting === debt.id}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {debt.interest_rate != null && (
          <span>APR: {Number(debt.interest_rate)}%</span>
        )}
        {debt.min_payment != null && (
          <span>Min: {formatCurrency(Number(debt.min_payment))}/mo</span>
        )}
        {debt.payoff_date && (
          <span>Payoff: {formatDate(debt.payoff_date)}</span>
        )}
      </div>
      {debt.notes && (
        <p className="text-xs text-muted-foreground border-t pt-2">{debt.notes}</p>
      )}
    </div>
  )
}

// ── Section block ────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: SectionState
  deleting: string | null
  onToggleCollapse: (id: string) => void
  onRename: (id: string, name: string) => void
  onAddDebt: (sectionId: string) => void
  onDeleteSection: (id: string) => void
  onEdit: (d: Debt) => void
  onDelete: (id: string) => void
}

function SectionBlock({
  section,
  deleting,
  onToggleCollapse,
  onRename,
  onAddDebt,
  onDeleteSection,
  onEdit,
  onDelete,
}: SectionBlockProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(section.name)

  const sectionTotal = section.debts.reduce((sum, d) => sum + Number(d.balance), 0)

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
          {section.debts.length} · {formatCurrency(sectionTotal)}
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
            <DropdownMenuItem onClick={() => onAddDebt(section.id)}>Add Debt</DropdownMenuItem>
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
          items={section.debts.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-3 pl-5 sm:grid-cols-2">
            {section.debts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs sm:col-span-2">
                No debts in this section — add one
              </div>
            ) : (
              section.debts.map((d) => (
                <SortableDebtCard
                  key={d.id}
                  debt={d}
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

export function DebtsTab({ userId, initialDebts, initialSections }: DebtsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [sections, setSections] = useState<SectionState[]>(() =>
    buildSections(initialSections, initialDebts)
  )
  const [unsectioned, setUnsectioned] = useState<Debt[]>(() =>
    initialDebts
      .filter((d) => !d.section_id)
      .sort((a, b) => a.position - b.position)
  )
  const sectionsRef = useRef(sections)
  const unsectionedRef = useRef(unsectioned)
  sectionsRef.current = sections
  unsectionedRef.current = unsectioned

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const totalDebt = useMemo(() => {
    const allDebts = [
      ...sections.flatMap((s) => s.debts),
      ...unsectioned,
    ]
    return allDebts.reduce((sum, d) => sum + Number(d.balance), 0)
  }, [sections, unsectioned])

  function findContainer(id: string): string {
    for (const sec of sectionsRef.current) {
      if (sec.id === id) return id
      if (sec.debts.find((d) => d.id === id)) return sec.id
    }
    if (id === "unsectioned") return "unsectioned"
    if (unsectionedRef.current.find((d) => d.id === id)) return "unsectioned"
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

    const getDebt = (containerId: string, debtId: string): Debt | undefined => {
      if (containerId === "unsectioned") {
        return unsectionedRef.current.find((d) => d.id === debtId)
      }
      return sectionsRef.current.find((s) => s.id === containerId)?.debts.find((d) => d.id === debtId)
    }

    const activeDebt = getDebt(activeContainer, String(active.id))
    if (!activeDebt) return

    if (overContainer === "unsectioned") {
      setSections((prev) =>
        prev.map((s) =>
          s.id === activeContainer
            ? { ...s, debts: s.debts.filter((d) => d.id !== active.id) }
            : s
        )
      )
      setUnsectioned((prev) => [...prev, { ...activeDebt, section_id: null }])
    } else if (activeContainer === "unsectioned") {
      setUnsectioned((prev) => prev.filter((d) => d.id !== active.id))
      setSections((prev) =>
        prev.map((s) =>
          s.id === overContainer
            ? { ...s, debts: [...s.debts, { ...activeDebt, section_id: overContainer }] }
            : s
        )
      )
    } else {
      setSections((prev) =>
        prev.map((s) => {
          if (s.id === activeContainer) {
            return { ...s, debts: s.debts.filter((d) => d.id !== active.id) }
          }
          if (s.id === overContainer) {
            return { ...s, debts: [...s.debts, { ...activeDebt, section_id: overContainer }] }
          }
          return s
        })
      )
    }
  }

  async function persistPositions(containerId: string, debts: Debt[]) {
    const updates = debts.map((d, i) => ({ id: d.id, position: i, section_id: d.section_id }))
    const { error } = await supabase.from("debts").upsert(updates as never)
    if (error) toast.error("Failed to save order")
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
        const oldIdx = unsectionedRef.current.findIndex((d) => d.id === active.id)
        const newIdx = unsectionedRef.current.findIndex((d) => d.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(unsectionedRef.current, oldIdx, newIdx)
          setUnsectioned(reordered)
          await persistPositions("unsectioned", reordered)
        }
      } else {
        const sec = sectionsRef.current.find((s) => s.id === activeContainer)
        if (!sec) return
        const oldIdx = sec.debts.findIndex((d) => d.id === active.id)
        const newIdx = sec.debts.findIndex((d) => d.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(sec.debts, oldIdx, newIdx)
          setSections((prev) => prev.map((s) => s.id === activeContainer ? { ...s, debts: reordered } : s))
          await persistPositions(activeContainer, reordered)
        }
      }
    } else {
      const newSectionId = overContainer === "unsectioned" ? null : overContainer
      await supabase.from("debts").update({ section_id: newSectionId }).eq("id", String(active.id))
      if (overContainer === "unsectioned") {
        await persistPositions("unsectioned", unsectionedRef.current)
      } else {
        const destSec = sectionsRef.current.find((s) => s.id === overContainer)
        if (destSec) await persistPositions(overContainer, destSec.debts)
      }
    }
  }

  const activeDebt = useMemo(() => {
    if (!activeId) return null
    for (const sec of sections) {
      const found = sec.debts.find((d) => d.id === activeId)
      if (found) return found
    }
    return unsectioned.find((d) => d.id === activeId) ?? null
  }, [activeId, sections, unsectioned])

  const form = useForm<FormValues>({
    resolver: zodResolver(debtSchema),
    defaultValues: {
      name: "", balance: 0, interest_rate: "", min_payment: "",
      payoff_date: "", notes: "", section_id: null,
    },
  })

  function openAdd(sectionId?: string) {
    form.reset({
      name: "", balance: 0, interest_rate: "", min_payment: "",
      payoff_date: "", notes: "", section_id: sectionId ?? null,
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(d: Debt) {
    form.reset({
      name: d.name,
      balance: Number(d.balance),
      interest_rate: d.interest_rate != null ? String(d.interest_rate) : "",
      min_payment: d.min_payment != null ? String(d.min_payment) : "",
      payoff_date: d.payoff_date ?? "",
      notes: d.notes ?? "",
      section_id: d.section_id ?? null,
    })
    setEditing(d)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      balance: values.balance,
      interest_rate: values.interest_rate ? parseFloat(values.interest_rate) : null,
      min_payment: values.min_payment ? parseFloat(values.min_payment) : null,
      payoff_date: values.payoff_date || null,
      notes: values.notes || null,
      section_id: values.section_id,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("debts")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update debt"); return }
      const updated = data
      if (updated.section_id) {
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            debts: s.id === updated.section_id
              ? s.debts.map((d) => (d.id === editing.id ? updated : d))
              : s.debts.filter((d) => d.id !== editing.id),
          }))
        )
        setUnsectioned((prev) => prev.filter((d) => d.id !== editing.id))
      } else {
        setSections((prev) =>
          prev.map((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== editing.id) }))
        )
        setUnsectioned((prev) => prev.map((d) => (d.id === editing.id ? updated : d)))
      }
      toast.success("Debt updated")
    } else {
      const position = payload.section_id
        ? (sections.find((s) => s.id === payload.section_id)?.debts.length ?? 0)
        : unsectioned.length
      const { data, error } = await supabase
        .from("debts")
        .insert({ ...payload, position })
        .select()
        .single()
      if (error) { toast.error("Failed to add debt"); return }
      if (data.section_id) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === data.section_id ? { ...s, debts: [...s.debts, data] } : s
          )
        )
      } else {
        setUnsectioned((prev) => [...prev, data])
      }
      toast.success("Debt added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("debts").delete().eq("id", id)
    if (error) { toast.error("Failed to delete debt"); setDeleting(null); return }
    setSections((prev) =>
      prev.map((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) }))
    )
    setUnsectioned((prev) => prev.filter((d) => d.id !== id))
    toast.success("Debt deleted")
    setDeleting(null)
  }

  async function handleRenameSection(id: string, name: string) {
    const { error } = await supabase.from("debt_sections").update({ name }).eq("id", id)
    if (error) { toast.error("Failed to rename section"); return }
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  async function handleDeleteSection(id: string) {
    const { error } = await supabase.from("debt_sections").delete().eq("id", id)
    if (error) { toast.error("Failed to delete section"); return }
    const orphans = sections.find((s) => s.id === id)?.debts ?? []
    setSections((prev) => prev.filter((s) => s.id !== id))
    setUnsectioned((prev) => [...prev, ...orphans.map((d) => ({ ...d, section_id: null }))])
    setDeleteSectionId(null)
    toast.success("Section deleted")
  }

  async function handleCreateSection() {
    const name = newSectionName.trim()
    if (!name) return
    const position = sections.length
    const { data, error } = await supabase
      .from("debt_sections")
      .insert({ name, position, user_id: userId })
      .select()
      .single()
    if (error) { toast.error("Failed to create section"); return }
    setSections((prev) => [...prev, { ...data, debts: [], collapsed: false }])
    setNewSectionName("")
    setNewSectionOpen(false)
    toast.success("Section created")
  }

  function toggleCollapse(id: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s))
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total debt</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setNewSectionOpen(true)}>
            <FolderPlus className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">New Section</span>
          </Button>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="size-4 mr-1" /> Add Debt
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
              deleting={deleting}
              onToggleCollapse={toggleCollapse}
              onRename={handleRenameSection}
              onAddDebt={(sId) => openAdd(sId)}
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
                items={unsectioned.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {unsectioned.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm sm:col-span-2">
                      No debts tracked — add a loan or credit card
                    </div>
                  ) : (
                    unsectioned.map((d) => (
                      <SortableDebtCard
                        key={d.id}
                        debt={d}
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
          {activeDebt && (
            <div className="rounded-lg border p-4 bg-card shadow-lg opacity-95 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground" />
                <CreditCard className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">{activeDebt.name}</span>
              </div>
              <p className="text-lg font-bold text-destructive">
                {formatCurrency(Number(activeDebt.balance))}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Debt" : "Add Debt"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Chase Sapphire, Student Loan" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Balance ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register("balance", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Interest Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 19.99"
                  {...form.register("interest_rate")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min Payment ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register("min_payment")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payoff Date</Label>
                <Input type="date" {...form.register("payoff_date")} />
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
              placeholder="e.g. Credit Cards"
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
            Debts in this section will be moved to &ldquo;No Section&rdquo;.
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
