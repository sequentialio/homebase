"use client"

import { useState, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, formatDate } from "@/lib/format-utils"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, GripVertical,
  ChevronDown, ChevronRight, MoreHorizontal, FolderPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Tables } from "@/types/database"

type Investment = Tables<"investments">
type InvestmentSection = Tables<"investment_sections">

interface SectionState extends InvestmentSection {
  investments: Investment[]
  collapsed: boolean
}

const ACCOUNT_TYPES = [
  { value: "401k", label: "401(k)" },
  { value: "403b", label: "403(b)" },
  { value: "ira", label: "Traditional IRA" },
  { value: "roth_ira", label: "Roth IRA" },
  { value: "roth_401k", label: "Roth 401(k)" },
  { value: "brokerage", label: "Brokerage" },
  { value: "hsa", label: "HSA" },
  { value: "crypto", label: "Crypto" },
  { value: "pension", label: "Pension" },
  { value: "other", label: "Other" },
] as const

function accountTypeLabel(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  institution: z.string().optional(),
  account_type: z.string().min(1),
  account_number: z.string().optional(),
  balance: z.number().min(0),
  cost_basis: z.string().optional(),
  gain_loss: z.string().optional(),
  rate_of_return: z.string().optional(),
  as_of_date: z.string().optional(),
  notes: z.string().optional(),
  section_id: z.string().nullable(),
})
type FormValues = z.infer<typeof schema>

interface InvestmentsTabProps {
  userId: string
  initialInvestments: Investment[]
  initialSections: InvestmentSection[]
}

function buildSections(rawSections: InvestmentSection[], rawItems: Investment[]): SectionState[] {
  return [...rawSections]
    .sort((a, b) => a.position - b.position)
    .map((sec) => ({
      ...sec,
      collapsed: false,
      investments: rawItems
        .filter((i) => i.section_id === sec.id)
        .sort((a, b) => a.position - b.position),
    }))
}

// ── Sortable row ─────────────────────────────────────────────────────────────

interface SortableRowProps {
  investment: Investment
  onEdit: (i: Investment) => void
  onDelete: (id: string) => void
  deleting: string | null
}

function SortableInvestmentRow({ investment: inv, onEdit, onDelete, deleting }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: inv.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const gainLoss = inv.gain_loss != null ? Number(inv.gain_loss) : null
  const ror = inv.rate_of_return != null ? Number(inv.rate_of_return) : null
  const isPositive = gainLoss != null ? gainLoss >= 0 : null

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border p-4 bg-card space-y-3">
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
            {isPositive !== false ? (
              <TrendingUp className="size-4 text-emerald-500" />
            ) : (
              <TrendingDown className="size-4 text-destructive" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{inv.name}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {accountTypeLabel(inv.account_type)}
              </Badge>
            </div>
            {inv.institution && (
              <p className="text-xs text-muted-foreground">{inv.institution}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="!size-7 !min-h-0" onClick={() => onEdit(inv)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="!size-7 !min-h-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(inv.id)}
            disabled={deleting === inv.id}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="font-semibold">{formatCurrency(Number(inv.balance))}</p>
        </div>
        {gainLoss != null && (
          <div>
            <p className="text-xs text-muted-foreground">Gain / Loss</p>
            <p className={`font-semibold ${gainLoss >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {gainLoss >= 0 ? "+" : ""}{formatCurrency(gainLoss)}
            </p>
          </div>
        )}
        {ror != null && (
          <div>
            <p className="text-xs text-muted-foreground">Rate of Return</p>
            <p className={`font-semibold ${ror >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {ror >= 0 ? "+" : ""}{ror.toFixed(2)}%
            </p>
          </div>
        )}
        {inv.cost_basis != null && (
          <div>
            <p className="text-xs text-muted-foreground">Cost Basis</p>
            <p className="font-semibold">{formatCurrency(Number(inv.cost_basis))}</p>
          </div>
        )}
      </div>

      {(inv.as_of_date || inv.account_number) && (
        <div className="flex gap-4 text-xs text-muted-foreground border-t pt-2">
          {inv.as_of_date && <span>As of {formatDate(inv.as_of_date)}</span>}
          {inv.account_number && <span>#{inv.account_number}</span>}
        </div>
      )}
      {inv.notes && (
        <p className="text-xs text-muted-foreground border-t pt-2">{inv.notes}</p>
      )}
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: SectionState
  deleting: string | null
  onToggleCollapse: (id: string) => void
  onRename: (id: string, name: string) => void
  onAddItem: (sectionId: string) => void
  onDeleteSection: (id: string) => void
  onEdit: (i: Investment) => void
  onDelete: (id: string) => void
}

function SectionBlock({
  section, deleting, onToggleCollapse, onRename, onAddItem, onDeleteSection, onEdit, onDelete,
}: SectionBlockProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(section.name)

  const total = section.investments.reduce((s, i) => s + Number(i.balance), 0)
  const totalGain = section.investments.reduce((s, i) => s + (i.gain_loss != null ? Number(i.gain_loss) : 0), 0)

  function commitRename() {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== section.name) onRename(section.id, trimmed)
    else setNameValue(section.name)
    setEditingName(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 group">
        <button onClick={() => onToggleCollapse(section.id)} className="text-muted-foreground hover:text-foreground">
          {section.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {editingName ? (
          <Input
            className="h-6 text-sm font-semibold px-1 py-0 w-40"
            value={nameValue} autoFocus
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") { setNameValue(section.name); setEditingName(false) }
            }}
          />
        ) : (
          <button className="text-sm font-semibold hover:underline" onDoubleClick={() => setEditingName(true)}>
            {section.name}
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-1">
          {section.investments.length} · {formatCurrency(total)}
          {totalGain !== 0 && (
            <span className={totalGain >= 0 ? " text-emerald-500" : " text-destructive"}>
              {" "}{totalGain >= 0 ? "+" : ""}{formatCurrency(totalGain)}
            </span>
          )}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="!size-6 !min-h-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditingName(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddItem(section.id)}>Add Investment</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDeleteSection(section.id)}>
              Delete Section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!section.collapsed && (
        <SortableContext items={section.investments.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 pl-5">
            {section.investments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                No investments in this section — add one
              </div>
            ) : (
              section.investments.map((i) => (
                <SortableInvestmentRow key={i.id} investment={i} onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
              ))
            )}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvestmentsTab({ userId, initialInvestments, initialSections }: InvestmentsTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [sections, setSections] = useState<SectionState[]>(() =>
    buildSections(initialSections, initialInvestments)
  )
  const [unsectioned, setUnsectioned] = useState<Investment[]>(() =>
    initialInvestments.filter((i) => !i.section_id).sort((a, b) => a.position - b.position)
  )
  const sectionsRef = useRef(sections)
  const unsectionedRef = useRef(unsectioned)
  sectionsRef.current = sections
  unsectionedRef.current = unsectioned

  const dragOriginContainer = useRef<string>("")

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { totalBalance, totalGainLoss } = useMemo(() => {
    const all = [...sections.flatMap((s) => s.investments), ...unsectioned]
    return {
      totalBalance: all.reduce((s, i) => s + Number(i.balance), 0),
      totalGainLoss: all.reduce((s, i) => s + (i.gain_loss != null ? Number(i.gain_loss) : 0), 0),
    }
  }, [sections, unsectioned])

  function findContainer(id: string): string {
    for (const sec of sectionsRef.current) {
      if (sec.id === id) return id
      if (sec.investments.find((i) => i.id === id)) return sec.id
    }
    if (id === "unsectioned") return "unsectioned"
    if (unsectionedRef.current.find((i) => i.id === id)) return "unsectioned"
    return ""
  }

  function handleDragStart(event: DragStartEvent) {
    dragOriginContainer.current = findContainer(String(event.active.id))
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const from = findContainer(String(active.id))
    const to = findContainer(String(over.id))
    if (!from || !to || from === to) return

    const getItem = (container: string, itemId: string) =>
      container === "unsectioned"
        ? unsectionedRef.current.find((i) => i.id === itemId)
        : sectionsRef.current.find((s) => s.id === container)?.investments.find((i) => i.id === itemId)

    const item = getItem(from, String(active.id))
    if (!item) return

    if (to === "unsectioned") {
      setSections((prev) => prev.map((s) => s.id === from ? { ...s, investments: s.investments.filter((i) => i.id !== active.id) } : s))
      setUnsectioned((prev) => [...prev, { ...item, section_id: null }])
    } else if (from === "unsectioned") {
      setUnsectioned((prev) => prev.filter((i) => i.id !== active.id))
      setSections((prev) => prev.map((s) => s.id === to ? { ...s, investments: [...s.investments, { ...item, section_id: to }] } : s))
    } else {
      setSections((prev) => prev.map((s) => {
        if (s.id === from) return { ...s, investments: s.investments.filter((i) => i.id !== active.id) }
        if (s.id === to) return { ...s, investments: [...s.investments, { ...item, section_id: to }] }
        return s
      }))
    }
  }

  async function persistPositions(items: Investment[]) {
    const results = await Promise.all(
      items.map((item, idx) =>
        supabase.from("investments").update({ position: idx, section_id: item.section_id }).eq("id", item.id)
      )
    )
    if (results.some((r) => r.error)) toast.error("Failed to save order")
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const from = dragOriginContainer.current || findContainer(String(active.id))
    const to = findContainer(String(over.id))
    if (!from || !to) return

    if (from === to) {
      if (from === "unsectioned") {
        const oldIdx = unsectionedRef.current.findIndex((i) => i.id === active.id)
        const newIdx = unsectionedRef.current.findIndex((i) => i.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(unsectionedRef.current, oldIdx, newIdx)
          setUnsectioned(reordered)
          await persistPositions(reordered)
        }
      } else {
        const sec = sectionsRef.current.find((s) => s.id === from)
        if (!sec) return
        const oldIdx = sec.investments.findIndex((i) => i.id === active.id)
        const newIdx = sec.investments.findIndex((i) => i.id === over.id)
        if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
          const reordered = arrayMove(sec.investments, oldIdx, newIdx)
          setSections((prev) => prev.map((s) => s.id === from ? { ...s, investments: reordered } : s))
          await persistPositions(reordered)
        }
      }
    } else {
      const newSectionId = to === "unsectioned" ? null : to
      await supabase.from("investments").update({ section_id: newSectionId }).eq("id", String(active.id))
      if (to === "unsectioned") {
        await persistPositions(unsectionedRef.current)
      } else {
        const destSec = sectionsRef.current.find((s) => s.id === to)
        if (destSec) await persistPositions(destSec.investments)
      }
      // Also persist source section to close the position gap
      if (from === "unsectioned") {
        await persistPositions(unsectionedRef.current)
      } else {
        const srcSec = sectionsRef.current.find((s) => s.id === from)
        if (srcSec) await persistPositions(srcSec.investments)
      }
    }
  }

  const activeInvestment = useMemo(() => {
    if (!activeId) return null
    for (const sec of sections) {
      const found = sec.investments.find((i) => i.id === activeId)
      if (found) return found
    }
    return unsectioned.find((i) => i.id === activeId) ?? null
  }, [activeId, sections, unsectioned])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", institution: "", account_type: "other", account_number: "",
      balance: 0, cost_basis: "", gain_loss: "", rate_of_return: "",
      as_of_date: "", notes: "", section_id: null,
    },
  })

  function openAdd(sectionId?: string) {
    form.reset({
      name: "", institution: "", account_type: "other", account_number: "",
      balance: 0, cost_basis: "", gain_loss: "", rate_of_return: "",
      as_of_date: "", notes: "", section_id: sectionId ?? null,
    })
    setEditing(null)
    setOpen(true)
  }

  function openEdit(inv: Investment) {
    form.reset({
      name: inv.name,
      institution: inv.institution ?? "",
      account_type: inv.account_type,
      account_number: inv.account_number ?? "",
      balance: Number(inv.balance),
      cost_basis: inv.cost_basis != null ? String(inv.cost_basis) : "",
      gain_loss: inv.gain_loss != null ? String(inv.gain_loss) : "",
      rate_of_return: inv.rate_of_return != null ? String(inv.rate_of_return) : "",
      as_of_date: inv.as_of_date ?? "",
      notes: inv.notes ?? "",
      section_id: inv.section_id ?? null,
    })
    setEditing(inv)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      institution: values.institution || null,
      account_type: values.account_type,
      account_number: values.account_number || null,
      balance: values.balance,
      cost_basis: values.cost_basis ? parseFloat(values.cost_basis) : null,
      gain_loss: values.gain_loss ? parseFloat(values.gain_loss) : null,
      rate_of_return: values.rate_of_return ? parseFloat(values.rate_of_return) : null,
      as_of_date: values.as_of_date || null,
      notes: values.notes || null,
      section_id: values.section_id,
    }

    if (editing) {
      const { data, error } = await supabase.from("investments").update(payload).eq("id", editing.id).select().single()
      if (error) { toast.error("Failed to update"); return }
      if (data.section_id) {
        setSections((prev) => prev.map((s) => ({
          ...s,
          investments: s.id === data.section_id
            ? s.investments.map((i) => (i.id === editing.id ? data : i))
            : s.investments.filter((i) => i.id !== editing.id),
        })))
        setUnsectioned((prev) => prev.filter((i) => i.id !== editing.id))
      } else {
        setSections((prev) => prev.map((s) => ({ ...s, investments: s.investments.filter((i) => i.id !== editing.id) })))
        setUnsectioned((prev) => prev.map((i) => (i.id === editing.id ? data : i)))
      }
      toast.success("Investment updated")
    } else {
      const position = payload.section_id
        ? (sections.find((s) => s.id === payload.section_id)?.investments.length ?? 0)
        : unsectioned.length
      const { data, error } = await supabase.from("investments").insert({ ...payload, position, user_id: userId }).select().single()
      if (error) { toast.error("Failed to add investment"); return }
      if (data.section_id) {
        setSections((prev) => prev.map((s) => s.id === data.section_id ? { ...s, investments: [...s.investments, data] } : s))
      } else {
        setUnsectioned((prev) => [...prev, data])
      }
      toast.success("Investment added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("investments").delete().eq("id", id)
    if (error) { toast.error("Failed to delete"); setDeleting(null); return }
    setSections((prev) => prev.map((s) => ({ ...s, investments: s.investments.filter((i) => i.id !== id) })))
    setUnsectioned((prev) => prev.filter((i) => i.id !== id))
    toast.success("Investment deleted")
    setDeleting(null)
  }

  async function handleRenameSection(id: string, name: string) {
    const { error } = await supabase.from("investment_sections").update({ name }).eq("id", id)
    if (error) { toast.error("Failed to rename"); return }
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  async function handleDeleteSection(id: string) {
    const { error } = await supabase.from("investment_sections").delete().eq("id", id)
    if (error) { toast.error("Failed to delete section"); return }
    const orphans = sections.find((s) => s.id === id)?.investments ?? []
    setSections((prev) => prev.filter((s) => s.id !== id))
    setUnsectioned((prev) => [...prev, ...orphans.map((i) => ({ ...i, section_id: null }))])
    setDeleteSectionId(null)
    toast.success("Section deleted")
  }

  async function handleCreateSection() {
    const name = newSectionName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from("investment_sections")
      .insert({ name, position: sections.length, user_id: userId })
      .select().single()
    if (error) { toast.error("Failed to create section"); return }
    setSections((prev) => [...prev, { ...data, investments: [], collapsed: false }])
    setNewSectionName("")
    setNewSectionOpen(false)
    toast.success("Section created")
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">Total portfolio</p>
          <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
          {totalGainLoss !== 0 && (
            <p className={`text-sm font-medium ${totalGainLoss >= 0 ? "text-emerald-500" : "text-destructive"}`}>
              {totalGainLoss >= 0 ? "+" : ""}{formatCurrency(totalGainLoss)} total gain/loss
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setNewSectionOpen(true)}>
            <FolderPlus className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">New Section</span>
          </Button>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="size-4 mr-1" /> Add Investment
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              deleting={deleting}
              onToggleCollapse={(id) => setSections((prev) => prev.map((s) => s.id === id ? { ...s, collapsed: !s.collapsed } : s))}
              onRename={handleRenameSection}
              onAddItem={(sId) => openAdd(sId)}
              onDeleteSection={(id) => setDeleteSectionId(id)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}

          {(unsectioned.length > 0 || sections.length === 0) && (
            <div className="space-y-2">
              {sections.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">No Section</p>
              )}
              <SortableContext items={unsectioned.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {unsectioned.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
                      No investments tracked yet — add a 401(k), IRA, or brokerage account
                    </div>
                  ) : (
                    unsectioned.map((i) => (
                      <SortableInvestmentRow key={i.id} investment={i} onEdit={openEdit} onDelete={handleDelete} deleting={deleting} />
                    ))
                  )}
                </div>
              </SortableContext>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeInvestment && (
            <div className="rounded-lg border p-4 bg-card shadow-lg opacity-95">
              <div className="flex items-center gap-2">
                <GripVertical className="size-4 text-muted-foreground" />
                <TrendingUp className="size-4 text-emerald-500" />
                <span className="font-medium text-sm">{activeInvestment.name}</span>
                <Badge variant="secondary" className="text-[10px]">{accountTypeLabel(activeInvestment.account_type)}</Badge>
              </div>
              <p className="text-lg font-bold mt-1">{formatCurrency(Number(activeInvestment.balance))}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Investment" : "Add Investment"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Name *</Label>
                <Input placeholder="e.g. Principal 403(b)" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Institution</Label>
                <Input placeholder="e.g. Vanguard, Fidelity" {...form.register("institution")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Account Type</Label>
                <Select
                  value={form.watch("account_type")}
                  onValueChange={(v) => form.setValue("account_type", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Account # (last 4)</Label>
                <Input placeholder="e.g. 5830" {...form.register("account_number")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Balance ($) *</Label>
                <Input type="number" step="0.01" min="0" placeholder="0.00"
                  {...form.register("balance", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost Basis ($)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...form.register("cost_basis")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gain / Loss ($)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 308.71" {...form.register("gain_loss")} />
              </div>
              <div className="space-y-1.5">
                <Label>Rate of Return (%)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 1.11" {...form.register("rate_of_return")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>As of Date</Label>
                <Input type="date" {...form.register("as_of_date")} />
              </div>
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Select
                  value={form.watch("section_id") ?? "none"}
                  onValueChange={(v) => form.setValue("section_id", v === "none" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="No section" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No section</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <DialogHeader><DialogTitle>New Section</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="e.g. Retirement, Brokerage"
              value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateSection() }}
              autoFocus />
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
          <DialogHeader><DialogTitle>Delete Section</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Investments in this section will be moved to &ldquo;No Section&rdquo;.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSectionId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteSectionId && handleDeleteSection(deleteSectionId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
