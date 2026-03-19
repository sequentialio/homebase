"use client"

import { useState, useMemo, useRef, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/format-utils"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, Landmark, GripVertical,
  ChevronRight, MoreHorizontal, FolderPlus,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type BankAccount = {
  id: string
  user_id: string
  name: string
  balance: number | string
  currency: string | null
  last_updated: string
  section_id: string | null
  position: number
  created_at: string
}

type AccountSection = {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string | null
}

type SectionState = AccountSection & {
  accounts: BankAccount[]
  collapsed: boolean
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  balance: z.number(),
  currency: z.string().min(1, "Currency is required"),
  section_id: z.string().nullable(),
})
type AccountFormValues = z.infer<typeof accountSchema>

// ── Props ─────────────────────────────────────────────────────────────────────

interface AccountsTabProps {
  userId: string
  initialAccounts: BankAccount[]
  initialSections: AccountSection[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSections(
  rawSections: AccountSection[],
  accounts: BankAccount[]
): SectionState[] {
  return [...rawSections]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      ...s,
      collapsed: false,
      accounts: accounts
        .filter((a) => a.section_id === s.id)
        .sort((a, b) => a.position - b.position),
    }))
}

// ── SortableAccountCard ───────────────────────────────────────────────────────

function AccountCard({
  account,
  onEdit,
  onDelete,
  deleting,
  overlay = false,
}: {
  account: BankAccount
  onEdit?: (a: BankAccount) => void
  onDelete?: (id: string) => void
  deleting?: string | null
  overlay?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5",
        overlay && "shadow-lg rotate-1 opacity-95"
      )}
    >
      <div className="text-muted-foreground/30 shrink-0">
        <GripVertical className="size-4" />
      </div>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Landmark className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{account.name}</p>
        <p className="text-base font-bold leading-tight">
          {formatCurrency(Number(account.balance), account.currency ?? "USD")}
        </p>
      </div>
      {!overlay && onEdit && onDelete && (
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="!size-7 !min-h-0"
            onClick={() => onEdit(account)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="!size-7 !min-h-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(account.id)}
            disabled={deleting === account.id}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

function SortableAccountCard({
  account,
  onEdit,
  onDelete,
  deleting,
}: {
  account: BankAccount
  onEdit: (a: BankAccount) => void
  onDelete: (id: string) => void
  deleting: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: account.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Landmark className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{account.name}</p>
        <p className="text-base font-bold leading-tight">
          {formatCurrency(Number(account.balance), account.currency ?? "USD")}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="!size-7 !min-h-0"
          onClick={() => onEdit(account)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="!size-7 !min-h-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(account.id)}
          disabled={deleting === account.id}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AccountsTab({
  userId,
  initialAccounts,
  initialSections,
}: AccountsTabProps) {
  const supabase = useMemo(() => createClient(), [])

  const [sections, setSections] = useState<SectionState[]>(() =>
    buildSections(initialSections, initialAccounts)
  )
  const [unsectioned, setUnsectioned] = useState<BankAccount[]>(() =>
    initialAccounts.filter((a) => !a.section_id)
  )

  // Keep a ref so DnD callbacks always see latest sections
  const sectionsRef = useRef<SectionState[]>(sections)
  sectionsRef.current = sections

  const dragOriginContainer = useRef<string | null>(null)

  const [activeAccount, setActiveAccount] = useState<BankAccount | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Account dialog
  const [accountDialog, setAccountDialog] = useState<{
    open: boolean
    editing: BankAccount | null
    sectionId: string | null
  }>({ open: false, editing: null, sectionId: null })

  // Delete section confirm
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null)

  // New section dialog
  const [newSectionOpen, setNewSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")
  const [savingSection, setSavingSection] = useState(false)

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: "", balance: 0, currency: "USD", section_id: null },
  })

  const totalBalance = useMemo(
    () =>
      sections.flatMap((s) => s.accounts).reduce((sum, a) => sum + Number(a.balance), 0) +
      unsectioned.reduce((sum, a) => sum + Number(a.balance), 0),
    [sections, unsectioned]
  )

  // ── DnD ────────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  function findContainer(id: string): string | null {
    const current = sectionsRef.current
    for (const s of current) {
      if (s.id === id) return id
      if (s.accounts.some((a) => a.id === id)) return s.id
    }
    return null
  }

  function findAccountById(id: string): BankAccount | null {
    for (const s of sectionsRef.current) {
      const a = s.accounts.find((a) => a.id === id)
      if (a) return a
    }
    return null
  }

  function handleDragStart({ active }: DragStartEvent) {
    dragOriginContainer.current = findContainer(active.id as string)
    setActiveAccount(findAccountById(active.id as string))
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setSections((prev) => {
      const activeSection = prev.find((s) => s.id === activeContainer)!
      const overSection = prev.find((s) => s.id === overContainer)!
      const account = activeSection.accounts.find((a) => a.id === activeId)!

      const overIdx = overSection.accounts.findIndex((a) => a.id === overId)
      const insertIdx = overIdx >= 0 ? overIdx : overSection.accounts.length

      const newOverAccounts = [...overSection.accounts]
      newOverAccounts.splice(insertIdx, 0, account)

      return prev.map((s) => {
        if (s.id === activeContainer)
          return { ...s, accounts: s.accounts.filter((a) => a.id !== activeId) }
        if (s.id === overContainer)
          return { ...s, accounts: newOverAccounts }
        return s
      })
    })
  }

  const persistPositions = useCallback(
    async (sectionId: string, accounts: BankAccount[]) => {
      const updates = accounts.map((a, i) => ({
        id: a.id,
        user_id: a.user_id,
        name: a.name,
        balance: Number(a.balance),
        currency: a.currency ?? "USD",
        last_updated: a.last_updated,
        created_at: a.created_at,
        section_id: sectionId,
        position: i,
      }))
      const { error } = await supabase.from("bank_accounts").upsert(updates as never)
      if (error) toast.error("Failed to save order")
    },
    [supabase]
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveAccount(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const current = sectionsRef.current
    const activeContainer = dragOriginContainer.current ?? findContainer(activeId)
    const overContainer = findContainer(overId)

    if (!activeContainer || !overContainer) return

    let finalSections = current

    if (activeContainer === overContainer && activeId !== overId) {
      finalSections = current.map((s) => {
        if (s.id !== activeContainer) return s
        const oldIdx = s.accounts.findIndex((a) => a.id === activeId)
        const newIdx = s.accounts.findIndex((a) => a.id === overId)
        if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return s
        return { ...s, accounts: arrayMove(s.accounts, oldIdx, newIdx) }
      })
      setSections(finalSections)
    }

    // Persist both affected sections
    const toUpdate = new Set([activeContainer, overContainer])
    for (const id of toUpdate) {
      const s = finalSections.find((s) => s.id === id)
      if (s) persistPositions(id, s.accounts)
    }
  }

  // ── Account CRUD ───────────────────────────────────────────────────────────

  function openAdd(sectionId: string | null = null) {
    form.reset({ name: "", balance: 0, currency: "USD", section_id: sectionId })
    setAccountDialog({ open: true, editing: null, sectionId })
  }

  function openEdit(account: BankAccount) {
    form.reset({
      name: account.name,
      balance: Number(account.balance),
      currency: account.currency ?? "USD",
      section_id: account.section_id,
    })
    setAccountDialog({ open: true, editing: account, sectionId: account.section_id })
  }

  async function onSubmit(values: AccountFormValues) {
    const payload = {
      user_id: userId,
      name: values.name,
      balance: values.balance,
      currency: values.currency,
      last_updated: new Date().toISOString(),
      section_id: values.section_id ?? null,
      position: 0,
    }

    if (accountDialog.editing) {
      const { data, error } = await supabase
        .from("bank_accounts")
        .update(payload)
        .eq("id", accountDialog.editing.id)
        .select()
        .single()
      if (error) { toast.error("Failed to update account"); return }
      const updated = data as BankAccount
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          accounts: s.accounts
            .filter((a) => a.id !== updated.id || s.id === updated.section_id)
            .map((a) => (a.id === updated.id ? updated : a)),
        })).map((s) => {
          if (s.id === updated.section_id && !s.accounts.find((a) => a.id === updated.id)) {
            return { ...s, accounts: [...s.accounts, updated] }
          }
          return s
        })
      )
      toast.success("Account updated")
    } else {
      // Position = count of existing accounts in that section
      const existingCount = sections.find((s) => s.id === payload.section_id)?.accounts.length ?? 0
      const { data, error } = await supabase
        .from("bank_accounts")
        .insert({ ...payload, position: existingCount })
        .select()
        .single()
      if (error) { toast.error("Failed to add account"); return }
      const created = data as BankAccount
      setSections((prev) =>
        prev.map((s) =>
          s.id === created.section_id
            ? { ...s, accounts: [...s.accounts, created] }
            : s
        )
      )
      if (!created.section_id) setUnsectioned((prev) => [...prev, created])
      toast.success("Account added")
    }
    setAccountDialog((d) => ({ ...d, open: false }))
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("bank_accounts").delete().eq("id", id)
    if (error) { toast.error("Failed to delete account"); setDeleting(null); return }
    setSections((prev) =>
      prev.map((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }))
    )
    setUnsectioned((prev) => prev.filter((a) => a.id !== id))
    toast.success("Account deleted")
    setDeleting(null)
  }

  // ── Section CRUD ───────────────────────────────────────────────────────────

  async function handleAddSection() {
    const name = newSectionName.trim()
    if (!name) return
    setSavingSection(true)
    const position = sections.length
    const { data, error } = await supabase
      .from("account_sections")
      .insert({ user_id: userId, name, position })
      .select()
      .single()
    setSavingSection(false)
    if (error) { toast.error("Failed to create section"); return }
    setSections((prev) => [...prev, { ...(data as AccountSection), accounts: [], collapsed: false }])
    setNewSectionName("")
    setNewSectionOpen(false)
    toast.success("Section created")
  }

  async function handleRenameSection(sectionId: string, name: string) {
    const { error } = await supabase
      .from("account_sections")
      .update({ name })
      .eq("id", sectionId)
    if (error) { toast.error("Failed to rename section"); return }
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, name } : s)))
  }

  async function handleDeleteSection(sectionId: string) {
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return

    // Ungroup accounts first
    if (section.accounts.length > 0) {
      await supabase
        .from("bank_accounts")
        .update({ section_id: null })
        .eq("section_id", sectionId)
      setUnsectioned((prev) => [...prev, ...section.accounts.map((a) => ({ ...a, section_id: null }))])
    }

    const { error } = await supabase
      .from("account_sections")
      .delete()
      .eq("id", sectionId)
    if (error) { toast.error("Failed to delete section"); return }

    setSections((prev) => prev.filter((s) => s.id !== sectionId))
    setDeleteSectionId(null)
    toast.success("Section deleted")
  }

  function toggleCollapse(sectionId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s))
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total balance</p>
          <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewSectionOpen(true)}>
            <FolderPlus className="size-4 mr-1.5" /> New Section
          </Button>
          <Button size="sm" onClick={() => openAdd(sections[0]?.id ?? null)}>
            <Plus className="size-4 mr-1" /> Add Account
          </Button>
        </div>
      </div>

      {/* Sections + DnD */}
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
              onCollapse={toggleCollapse}
              onAddAccount={openAdd}
              onEdit={openEdit}
              onDelete={handleDelete}
              onRename={handleRenameSection}
              onDeleteSection={(id) => setDeleteSectionId(id)}
              deleting={deleting}
            />
          ))}

          {/* Unsectioned accounts */}
          {unsectioned.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Ungrouped
              </p>
              <div className="space-y-2">
                {unsectioned.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    deleting={deleting}
                  />
                ))}
              </div>
            </div>
          )}

          {sections.length === 0 && unsectioned.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              No accounts yet — add a section and your first account
            </div>
          )}
        </div>

        <DragOverlay>
          {activeAccount && (
            <AccountCard account={activeAccount} overlay />
          )}
        </DragOverlay>
      </DndContext>

      {/* Account dialog */}
      <Dialog
        open={accountDialog.open}
        onOpenChange={(open) => setAccountDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {accountDialog.editing ? "Edit Account" : "Add Account"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input placeholder="e.g. SCFCU Checking" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...form.register("balance", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input placeholder="USD" {...form.register("currency")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select
                value={form.watch("section_id") ?? "none"}
                onValueChange={(v) =>
                  form.setValue("section_id", v === "none" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No section</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountDialog((d) => ({ ...d, open: false }))}
              >
                Cancel
              </Button>
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
            <Label>Section Name</Label>
            <Input
              placeholder="e.g. Relay"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSectionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSection} disabled={savingSection || !newSectionName.trim()}>
              {savingSection ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete section confirm */}
      <Dialog
        open={!!deleteSectionId}
        onOpenChange={(open) => !open && setDeleteSectionId(null)}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Accounts in this section will be ungrouped. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSectionId(null)}>
              Cancel
            </Button>
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

// ── Section Block ─────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  onCollapse,
  onAddAccount,
  onEdit,
  onDelete,
  onRename,
  onDeleteSection,
  deleting,
}: {
  section: SectionState
  onCollapse: (id: string) => void
  onAddAccount: (sectionId: string) => void
  onEdit: (a: BankAccount) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onDeleteSection: (id: string) => void
  deleting: string | null
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(section.name)

  function commitRename() {
    setEditingName(false)
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== section.name) {
      onRename(section.id, trimmed)
    } else {
      setNameValue(section.name)
    }
  }

  const sectionTotal = section.accounts.reduce((sum, a) => sum + Number(a.balance), 0)

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2 group">
        <button
          onClick={() => onCollapse(section.id)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform duration-150",
              !section.collapsed && "rotate-90"
            )}
          />
        </button>

        {editingName ? (
          <Input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") {
                setEditingName(false)
                setNameValue(section.name)
              }
            }}
            className="h-7 text-sm font-semibold py-0 px-1.5 w-44"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="font-semibold text-sm hover:text-foreground/70 text-left"
          >
            {section.name}
          </button>
        )}

        <span className="text-xs text-muted-foreground">
          {section.accounts.length}
        </span>

        <span className="text-xs text-muted-foreground ml-auto">
          {formatCurrency(sectionTotal)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="!size-6 !min-h-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditingName(true)}>
              Rename section
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddAccount(section.id)}>
              Add account
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteSection(section.id)}
              className="text-destructive focus:text-destructive"
            >
              Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Accounts list */}
      {!section.collapsed && (
        <div className="ml-6 space-y-2">
          <SortableContext
            items={section.accounts.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            {section.accounts.map((account) => (
              <SortableAccountCard
                key={account.id}
                account={account}
                onEdit={onEdit}
                onDelete={onDelete}
                deleting={deleting}
              />
            ))}
          </SortableContext>

          {section.accounts.length === 0 && (
            <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              No accounts — drag one here or add new
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => onAddAccount(section.id)}
          >
            <Plus className="size-3.5" />
            Add Account
          </Button>
        </div>
      )}
    </div>
  )
}
