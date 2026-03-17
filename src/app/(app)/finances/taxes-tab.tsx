"use client"

import { useState, useMemo, useRef } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, GripVertical,
  ChevronDown, ChevronRight, MoreHorizontal, FolderPlus,
  CheckCircle2, Circle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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

type TaxItem = Tables<"tax_items">
type TaxSection = Tables<"tax_sections">

interface SectionState extends TaxSection {
  items: TaxItem[]
  collapsed: boolean
}

const TAX_ITEM_TYPES = ["income", "deduction", "credit", "payment", "other"] as const
type TaxItemType = (typeof TAX_ITEM_TYPES)[number]

const TYPE_LABELS: Record<TaxItemType, string> = {
  income: "Income",
  deduction: "Deduction",
  credit: "Credit",
  payment: "Payment",
  other: "Other",
}

const TYPE_COLORS: Record<TaxItemType, string> = {
  income: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  deduction: "bg-green-500/15 text-green-500 border-green-500/20",
  credit: "bg-brand-lime/15 text-brand-lime border-brand-lime/20",
  payment: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  other: "bg-muted text-muted-foreground border-border",
}

const taxItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1),
  amount: z.string().optional(),
  tax_year: z.number().int().min(2000).max(2100),
  filed: z.boolean(),
  due_date: z.string().optional(),
  section_id: z.string().nullable(),
  notes: z.string().optional(),
})
type TaxItemForm = z.infer<typeof taxItemSchema>

const sectionSchema = z.object({ name: z.string().min(1) })
type SectionForm = z.infer<typeof sectionSchema>

function buildSections(rawSections: TaxSection[], rawItems: TaxItem[]): SectionState[] {
  const map = new Map<string, SectionState>()
  for (const s of rawSections) {
    map.set(s.id, { ...s, items: [], collapsed: false })
  }
  for (const item of rawItems) {
    if (item.section_id && map.has(item.section_id)) {
      map.get(item.section_id)!.items.push(item)
    }
  }
  return Array.from(map.values()).sort((a, b) => a.position - b.position)
}

async function persistPositions(
  supabase: ReturnType<typeof createClient>,
  table: "tax_sections" | "tax_items",
  items: { id: string }[]
) {
  const updates = items.map((item, i) => ({ id: item.id, position: i + 1 }))
  await supabase.from(table).upsert(updates)
}

// ── Sortable Row ──────────────────────────────────────────────────────────────

interface SortableTaxRowProps {
  item: TaxItem
  onEdit: (item: TaxItem) => void
  onDelete: (id: string) => void
  onToggleFiled: (item: TaxItem) => void
}

function SortableTaxRow({ item, onEdit, onDelete, onToggleFiled }: SortableTaxRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const typeKey = (item.type ?? "other") as TaxItemType
  const colorClass = TYPE_COLORS[typeKey] ?? TYPE_COLORS.other

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2.5"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0">
        <GripVertical className="size-4" />
      </button>

      <button
        onClick={() => onToggleFiled(item)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={item.filed ? "Mark unfiled" : "Mark filed"}
      >
        {item.filed
          ? <CheckCircle2 className="size-4 text-green-500" />
          : <Circle className="size-4" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${item.filed ? "line-through text-muted-foreground" : ""}`}>
            {item.name}
          </span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colorClass}`}>
            {TYPE_LABELS[typeKey] ?? item.type}
          </Badge>
          {item.due_date && (
            <span className="text-xs text-muted-foreground">
              Due {new Date(item.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        {item.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>}
      </div>

      <div className="text-sm font-medium tabular-nums shrink-0">
        {item.amount != null ? formatCurrency(item.amount) : "—"}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="!size-7 shrink-0 text-muted-foreground">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Pencil className="size-3.5 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-destructive">
            <Trash2 className="size-3.5 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ── Section Block ─────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: SectionState
  onAddItem: (sectionId: string) => void
  onEditItem: (item: TaxItem) => void
  onDeleteItem: (id: string) => void
  onToggleFiled: (item: TaxItem) => void
  onToggleCollapse: (id: string) => void
  onRenameSection: (id: string, name: string) => void
  onDeleteSection: (id: string) => void
  viewYear: number
}

function SectionBlock({
  section, onAddItem, onEditItem, onDeleteItem, onToggleFiled,
  onToggleCollapse, onRenameSection, onDeleteSection, viewYear,
}: SectionBlockProps) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(section.name)

  const yearItems = section.items.filter((i) => i.tax_year === viewYear)
  const total = yearItems.reduce((sum, i) => sum + (i.amount ?? 0), 0)

  function commitRename() {
    setEditing(false)
    if (nameVal.trim() && nameVal !== section.name) onRenameSection(section.id, nameVal.trim())
    else setNameVal(section.name)
  }

  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <button onClick={() => onToggleCollapse(section.id)} className="text-muted-foreground hover:text-foreground">
          {section.collapsed
            ? <ChevronRight className="size-4" />
            : <ChevronDown className="size-4" />}
        </button>
        {editing ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditing(false); setNameVal(section.name) } }}
            className="flex-1 bg-transparent text-sm font-semibold outline-none border-b border-primary"
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold cursor-pointer select-none"
            onDoubleClick={() => setEditing(true)}
          >
            {section.name}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(total)}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="!size-7 text-muted-foreground">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="size-3.5 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddItem(section.id)}>
              <Plus className="size-3.5 mr-2" /> Add Item
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDeleteSection(section.id)} className="text-destructive">
              <Trash2 className="size-3.5 mr-2" /> Delete Section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!section.collapsed && (
        <div className="p-2 space-y-1.5">
          <SortableContext items={yearItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {yearItems.map((item) => (
              <SortableTaxRow
                key={item.id}
                item={item}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
                onToggleFiled={onToggleFiled}
              />
            ))}
          </SortableContext>
          {yearItems.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No items for {viewYear}</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground text-xs gap-1.5 h-7"
            onClick={() => onAddItem(section.id)}
          >
            <Plus className="size-3.5" /> Add item
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface TaxesTabProps {
  userId: string
  initialItems: TaxItem[]
  initialSections: TaxSection[]
}

export function TaxesTab({ userId, initialItems, initialSections }: TaxesTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const currentYear = new Date().getFullYear()
  const [viewYear, setViewYear] = useState(currentYear)
  const [sections, setSections] = useState<SectionState[]>(() =>
    buildSections(initialSections, initialItems)
  )
  const [unsectioned, setUnsectioned] = useState<TaxItem[]>(() =>
    initialItems.filter((i) => !i.section_id)
  )
  const sectionsRef = useRef(sections)
  const unsectionedRef = useRef(unsectioned)
  sectionsRef.current = sections
  unsectionedRef.current = unsectioned

  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TaxItem | null>(null)
  const [defaultSectionId, setDefaultSectionId] = useState<string | null>(null)
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const yearItems = useMemo(() => {
    const fromSections = sections.flatMap((s) => s.items.filter((i) => i.tax_year === viewYear))
    const fromUnsectioned = unsectioned.filter((i) => i.tax_year === viewYear)
    return [...fromSections, ...fromUnsectioned]
  }, [sections, unsectioned, viewYear])

  const typeTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const item of yearItems) {
      totals[item.type] = (totals[item.type] ?? 0) + (item.amount ?? 0)
    }
    return totals
  }, [yearItems])

  const yearRange = useMemo(() => {
    const years: number[] = []
    for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y)
    return years
  }, [currentYear])

  // ── Item Form ────────────────────────────────────────────────────────────────

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<TaxItemForm>({
    resolver: zodResolver(taxItemSchema),
    defaultValues: { type: "income", filed: false, tax_year: currentYear, section_id: null },
  })

  function openAdd(sectionId: string | null = null) {
    setEditingItem(null)
    setDefaultSectionId(sectionId)
    reset({ type: "income", filed: false, tax_year: viewYear, section_id: sectionId })
    setDialogOpen(true)
  }

  function openEdit(item: TaxItem) {
    setEditingItem(item)
    reset({
      name: item.name,
      type: item.type,
      amount: item.amount != null ? String(item.amount) : "",
      tax_year: item.tax_year,
      filed: item.filed,
      due_date: item.due_date ?? "",
      section_id: item.section_id,
      notes: item.notes ?? "",
    })
    setDialogOpen(true)
  }

  async function onSubmit(data: TaxItemForm) {
    const amount = data.amount ? parseFloat(data.amount) : null
    const payload = {
      name: data.name,
      type: data.type,
      amount: isNaN(amount as number) ? null : amount,
      tax_year: data.tax_year,
      filed: data.filed,
      due_date: data.due_date || null,
      section_id: data.section_id || null,
      notes: data.notes || null,
      user_id: userId,
    }

    if (editingItem) {
      const { error } = await supabase.from("tax_items").update(payload).eq("id", editingItem.id)
      if (error) { toast.error("Failed to update item"); return }
      const updated = { ...editingItem, ...payload }
      setSections((prev) => prev.map((s) => ({
        ...s,
        items: s.items.map((i) => i.id === editingItem.id ? updated : i),
      })))
      setUnsectioned((prev) => prev.map((i) => i.id === editingItem.id ? updated : i))
      toast.success("Item updated")
    } else {
      const position = (() => {
        if (!payload.section_id) return unsectionedRef.current.length + 1
        const sec = sectionsRef.current.find((s) => s.id === payload.section_id)
        return (sec?.items.length ?? 0) + 1
      })()
      const { data: created, error } = await supabase
        .from("tax_items")
        .insert({ ...payload, position })
        .select()
        .single()
      if (error || !created) { toast.error("Failed to add item"); return }
      if (created.section_id) {
        setSections((prev) => prev.map((s) =>
          s.id === created.section_id ? { ...s, items: [...s.items, created] } : s
        ))
      } else {
        setUnsectioned((prev) => [...prev, created])
      }
      toast.success("Item added")
    }
    setDialogOpen(false)
  }

  async function deleteItem(id: string) {
    const { error } = await supabase.from("tax_items").delete().eq("id", id)
    if (error) { toast.error("Failed to delete"); return }
    setSections((prev) => prev.map((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })))
    setUnsectioned((prev) => prev.filter((i) => i.id !== id))
    toast.success("Item deleted")
  }

  async function toggleFiled(item: TaxItem) {
    const { error } = await supabase.from("tax_items").update({ filed: !item.filed }).eq("id", item.id)
    if (error) { toast.error("Failed to update"); return }
    const updated = { ...item, filed: !item.filed }
    setSections((prev) => prev.map((s) => ({
      ...s,
      items: s.items.map((i) => i.id === item.id ? updated : i),
    })))
    setUnsectioned((prev) => prev.map((i) => i.id === item.id ? updated : i))
  }

  // ── Section CRUD ─────────────────────────────────────────────────────────────

  const { register: regSection, handleSubmit: handleSection, reset: resetSection, formState: { isSubmitting: isSectionSubmitting } } = useForm<SectionForm>({
    resolver: zodResolver(sectionSchema),
  })

  async function onAddSection(data: SectionForm) {
    const position = sectionsRef.current.length + 1
    const { data: created, error } = await supabase
      .from("tax_sections")
      .insert({ name: data.name, position, user_id: userId })
      .select()
      .single()
    if (error || !created) { toast.error("Failed to create section"); return }
    setSections((prev) => [...prev, { ...created, items: [], collapsed: false }])
    setSectionDialogOpen(false)
    resetSection()
    toast.success("Section created")
  }

  async function renameSection(id: string, name: string) {
    await supabase.from("tax_sections").update({ name }).eq("id", id)
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, name } : s))
  }

  async function deleteSection(id: string) {
    await supabase.from("tax_items").update({ section_id: null }).eq("section_id", id)
    const { data: orphaned } = await supabase.from("tax_items").select("*").eq("section_id", id)
    await supabase.from("tax_sections").delete().eq("id", id)
    setSections((prev) => prev.filter((s) => s.id !== id))
    if (orphaned?.length) setUnsectioned((prev) => [...prev, ...orphaned])
    toast.success("Section deleted")
  }

  function toggleCollapse(id: string) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, collapsed: !s.collapsed } : s))
  }

  // ── DnD ──────────────────────────────────────────────────────────────────────

  function findContainer(itemId: string): string | null {
    if (unsectionedRef.current.some((i) => i.id === itemId)) return "__unsectioned__"
    for (const s of sectionsRef.current) {
      if (s.id === itemId || s.items.some((i) => i.id === itemId)) return s.id
    }
    return null
  }

  function onDragStart({ active }: DragStartEvent) { setActiveId(active.id as string) }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const fromId = findContainer(active.id as string)
    const toId = findContainer(over.id as string) ?? (over.id as string)
    if (!fromId || !toId || fromId === toId) return

    const activeItem = (() => {
      if (fromId === "__unsectioned__") return unsectionedRef.current.find((i) => i.id === active.id)
      return sectionsRef.current.find((s) => s.id === fromId)?.items.find((i) => i.id === active.id)
    })()
    if (!activeItem) return

    if (fromId === "__unsectioned__") {
      setUnsectioned((prev) => prev.filter((i) => i.id !== active.id))
    } else {
      setSections((prev) => prev.map((s) => s.id === fromId ? { ...s, items: s.items.filter((i) => i.id !== active.id) } : s))
    }

    const newSectionId = toId === "__unsectioned__" ? null : toId
    const moved = { ...activeItem, section_id: newSectionId }

    if (toId === "__unsectioned__") {
      setUnsectioned((prev) => [...prev, moved])
    } else {
      setSections((prev) => prev.map((s) => s.id === toId ? { ...s, items: [...s.items, moved] } : s))
    }
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return
    const fromId = findContainer(active.id as string)
    const toId = findContainer(over.id as string) ?? (over.id as string)
    if (!fromId || !toId) return

    if (fromId === toId) {
      // Same container reorder
      if (fromId === "__unsectioned__") {
        const items = unsectionedRef.current
        const oldIdx = items.findIndex((i) => i.id === active.id)
        const newIdx = items.findIndex((i) => i.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(items, oldIdx, newIdx)
          setUnsectioned(reordered)
          await persistPositions(supabase, "tax_items", reordered)
        }
      } else {
        const sec = sectionsRef.current.find((s) => s.id === fromId)
        if (!sec) return
        const oldIdx = sec.items.findIndex((i) => i.id === active.id)
        const newIdx = sec.items.findIndex((i) => i.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(sec.items, oldIdx, newIdx)
          setSections((prev) => prev.map((s) => s.id === fromId ? { ...s, items: reordered } : s))
          await persistPositions(supabase, "tax_items", reordered)
        }
      }
    } else {
      // Cross-container: persist new section_id + reorder
      const newSectionId = toId === "__unsectioned__" ? null : toId
      await supabase.from("tax_items").update({ section_id: newSectionId }).eq("id", active.id as string)
      if (toId === "__unsectioned__") {
        await persistPositions(supabase, "tax_items", unsectionedRef.current)
      } else {
        const sec = sectionsRef.current.find((s) => s.id === toId)
        if (sec) await persistPositions(supabase, "tax_items", sec.items)
      }
    }
  }

  const activeItem = activeId
    ? [...sections.flatMap((s) => s.items), ...unsectioned].find((i) => i.id === activeId)
    : null

  const unsectionedYear = unsectioned.filter((i) => i.tax_year === viewYear)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Taxes</h2>
          <Select value={String(viewYear)} onValueChange={(v) => setViewYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearRange.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSectionDialogOpen(true); resetSection() }}>
            <FolderPlus className="size-3.5" /> New Section
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => openAdd()}>
            <Plus className="size-3.5" /> Add Item
          </Button>
        </div>
      </div>

      {/* Summary */}
      {yearItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TAX_ITEM_TYPES.map((t) => (
            <div key={t} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${t === "credit" ? "text-brand-lime" : ""}`}>
                {TYPE_LABELS[t]}
              </div>
              <div className="text-sm font-bold tabular-nums">
                {typeTotals[t] ? formatCurrency(typeTotals[t]) : "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DnD */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className="space-y-3">
          {sections.map((section) => (
            <SortableContext key={section.id} items={[section.id, ...section.items.filter((i) => i.tax_year === viewYear).map((i) => i.id)]} strategy={verticalListSortingStrategy}>
              <SectionBlock
                section={section}
                viewYear={viewYear}
                onAddItem={openAdd}
                onEditItem={openEdit}
                onDeleteItem={deleteItem}
                onToggleFiled={toggleFiled}
                onToggleCollapse={toggleCollapse}
                onRenameSection={renameSection}
                onDeleteSection={deleteSection}
              />
            </SortableContext>
          ))}

          {/* Unsectioned */}
          {(unsectionedYear.length > 0 || sections.length === 0) && (
            <div className="space-y-1.5">
              {sections.length > 0 && (
                <p className="text-xs text-muted-foreground px-1 font-medium">Unsectioned</p>
              )}
              <SortableContext items={unsectionedYear.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {unsectionedYear.map((item) => (
                  <SortableTaxRow
                    key={item.id}
                    item={item}
                    onEdit={openEdit}
                    onDelete={deleteItem}
                    onToggleFiled={toggleFiled}
                  />
                ))}
              </SortableContext>
              {unsectionedYear.length === 0 && sections.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  <p className="text-sm">No tax items for {viewYear}</p>
                  <p className="text-xs mt-1">Add W-2s, 1099s, deductions, credits, and more</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeItem && (
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2.5 shadow-lg opacity-90">
              <GripVertical className="size-4 text-muted-foreground/40" />
              <span className="text-sm font-medium">{activeItem.name}</span>
              {activeItem.amount != null && (
                <span className="ml-auto text-sm tabular-nums">{formatCurrency(activeItem.amount)}</span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add/Edit Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Tax Item" : "Add Tax Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...register("name")} placeholder="e.g. W-2 from Employer, Mortgage Interest" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TAX_ITEM_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tax Year</Label>
                <Controller
                  name="tax_year"
                  control={control}
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {yearRange.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input {...register("amount")} type="number" step="0.01" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input {...register("due_date")} type="date" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Section</Label>
              <Controller
                name="section_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="No section" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No section</SelectItem>
                      {sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
              <Label className="cursor-pointer">Filed</Label>
              <Controller
                name="filed"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} placeholder="Optional notes..." rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : editingItem ? "Save Changes" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Section</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSection(onAddSection)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Section Name</Label>
              <Input {...regSection("name")} placeholder="e.g. 2024 Federal, Investments" autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSectionDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSectionSubmitting}>Create Section</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
