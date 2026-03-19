"use client"

import { useMemo, useState, useRef, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { formatDate } from "@/lib/format-utils"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowLeftRight,
  GripVertical,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ListPlus,
} from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type GroceryItem = Tables<"grocery_items"> & {
  position?: number | null
  checked?: boolean | null
}

const GROCERY_CATEGORY_SUGGESTIONS = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bread & Bakery",
  "Pantry & Dry Goods",
  "Frozen",
  "Beverages",
  "Snacks",
  "Cleaning",
  "Personal Care",
  "Other",
]

const UNCATEGORIZED = "Uncategorized"

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.number().min(0),
  unit: z.string().optional(),
  category: z.string().optional(),
  in_pantry: z.boolean(),
  low_threshold: z.number().min(0).optional().nullable(),
  expiry_date: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

interface GroceriesTabProps {
  userId: string
  items: GroceryItem[]
  setItems: React.Dispatch<React.SetStateAction<GroceryItem[]>>
  view: "shopping" | "pantry"
}

// ─── Sortable item row ────────────────────────────────────────────────────────

interface SortableRowProps {
  item: GroceryItem
  view: "shopping" | "pantry"
  isMoving: boolean
  isDeleting: boolean
  onCheck: (item: GroceryItem) => void
  onTogglePantry: (item: GroceryItem) => void
  onEdit: (item: GroceryItem) => void
  onDelete: (id: string) => void
  onStepQuantity: (item: GroceryItem, delta: number) => void
  isLowStock: (item: GroceryItem) => boolean
  isExpiringSoon: (item: GroceryItem) => boolean
  overlay?: boolean
}

function SortableRow({
  item,
  view,
  isMoving,
  isDeleting,
  onCheck,
  onTogglePantry,
  onEdit,
  onDelete,
  onStepQuantity,
  isLowStock,
  isExpiringSoon,
  overlay = false,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !overlay ? 0.4 : 1,
  }

  const checked = item.checked ?? false

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-3",
        overlay && "shadow-lg bg-card",
        checked && "opacity-60"
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

      {/* Shopping checkbox */}
      {view === "shopping" && (
        <button
          className="shrink-0 size-5 rounded-full border-2 border-border flex items-center justify-center hover:border-primary transition-colors"
          onClick={() => onCheck(item)}
          aria-label={checked ? "Uncheck item" : "Check item"}
        >
          {checked && <div className="size-2.5 rounded-full bg-primary" />}
        </button>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "font-medium text-sm truncate",
              checked && "line-through text-muted-foreground"
            )}
          >
            {item.name}
          </span>
          {isLowStock(item) && (
            <Badge
              variant="outline"
              className="text-xs text-yellow-600 dark:text-yellow-400 border-yellow-400/50 gap-1"
            >
              <AlertTriangle className="size-3" /> Low
            </Badge>
          )}
          {isExpiringSoon(item) && (
            <Badge
              variant="outline"
              className="text-xs text-red-600 dark:text-red-400 border-red-400/50 gap-1"
            >
              <AlertTriangle className="size-3" /> Expiring
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
          {view !== "pantry" && Number(item.quantity) > 0 && (
            <span>
              {Number(item.quantity)}
              {item.unit ? ` ${item.unit}` : ""}
            </span>
          )}
          {item.category && <span>· {item.category}</span>}
          {item.expiry_date && <span>· Expires {formatDate(item.expiry_date)}</span>}
        </div>
      </div>

      {/* Pantry quantity stepper */}
      {view === "pantry" && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="!size-6 !min-h-0 text-xs"
            onClick={() => onStepQuantity(item, -1)}
            disabled={Number(item.quantity) <= 0}
          >
            –
          </Button>
          <span className="text-sm font-medium w-6 text-center tabular-nums">
            {Number(item.quantity)}
            {item.unit ? (
              <span className="text-xs text-muted-foreground ml-0.5">{item.unit}</span>
            ) : null}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="!size-6 !min-h-0 text-xs"
            onClick={() => onStepQuantity(item, 1)}
          >
            +
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="!size-7 !min-h-0 text-muted-foreground hover:text-foreground"
          title={view === "shopping" ? "Move to pantry" : "Back to list"}
          onClick={() => onTogglePantry(item)}
          disabled={isMoving}
        >
          <ArrowLeftRight className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="!size-7 !min-h-0"
          onClick={() => onEdit(item)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="!size-7 !min-h-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GroceriesTab({ userId, items, setItems, view }: GroceriesTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const dragOriginContainer = useRef<string | null>(null)
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Items for the current view (shopping or pantry)
  const viewItems = useMemo(
    () => items.filter((i) => (view === "shopping" ? !i.in_pantry : i.in_pantry)),
    [items, view]
  )

  // All unique categories across all items + suggestions for datalist
  const allCategoryOptions = useMemo(() => {
    const fromItems = items.map((i) => i.category).filter(Boolean) as string[]
    return Array.from(new Set([...GROCERY_CATEGORY_SUGGESTIONS, ...fromItems])).sort()
  }, [items])

  // Keep a ref so DnD callbacks never go stale
  const itemsRef = useRef<GroceryItem[]>(viewItems)
  itemsRef.current = viewItems

  const checkedCount = useMemo(
    () => viewItems.filter((i) => i.checked).length,
    [viewItems]
  )

  // Category filter chips
  const categories = useMemo(() => {
    const cats = new Set(viewItems.map((i) => i.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [viewItems])

  // Build groups from data (derived, not hardcoded)
  const groups = useMemo(() => {
    const filtered =
      categoryFilter === "all"
        ? viewItems
        : viewItems.filter((i) => (i.category ?? UNCATEGORIZED) === categoryFilter)

    const map = new Map<string, GroceryItem[]>()

    for (const item of filtered) {
      const key = item.category ?? UNCATEGORIZED
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }

    // Sort within each group
    for (const [key, groupItems] of map) {
      if (view === "pantry") {
        map.set(
          key,
          [...groupItems].sort((a, b) => {
            const aAlert = isLowStock(a) || isExpiringSoon(a) ? 0 : 1
            const bAlert = isLowStock(b) || isExpiringSoon(b) ? 0 : 1
            if (aAlert !== bAlert) return aAlert - bAlert
            return (a.position ?? 0) - (b.position ?? 0)
          })
        )
      } else {
        map.set(
          key,
          [...groupItems].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        )
      }
    }

    // Include empty custom categories as drop targets
    for (const cat of customCategories) {
      if (!map.has(cat)) map.set(cat, [])
    }

    // Move "Uncategorized" to the bottom
    const ordered: [string, GroceryItem[]][] = []
    for (const [k, v] of map) {
      if (k !== UNCATEGORIZED) ordered.push([k, v])
    }
    if (map.has(UNCATEGORIZED)) ordered.push([UNCATEGORIZED, map.get(UNCATEGORIZED)!])

    return ordered
  }, [viewItems, categoryFilter, view, customCategories])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isLowStock(item: GroceryItem) {
    return (
      item.in_pantry &&
      item.low_threshold != null &&
      Number(item.quantity) <= Number(item.low_threshold)
    )
  }

  function isExpiringSoon(item: GroceryItem) {
    if (!item.expiry_date) return false
    const days = (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days <= 7
  }

  function findContainer(id: string): string | null {
    const item = itemsRef.current.find((i) => i.id === id)
    return item ? (item.category ?? UNCATEGORIZED) : null
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

  async function persistPositions(groupItems: GroceryItem[]) {
    const results = await Promise.all(
      groupItems.map((item, i) =>
        supabase.from("grocery_items").update({ position: i }).eq("id", item.id)
      )
    )
    if (results.some((r) => r.error)) toast.error("Failed to save order")
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    dragOriginContainer.current = findContainer(event.active.id as string)
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id as string)
    const overContainer = findContainer(over.id as string) ?? (over.id as string)

    if (!activeContainer || activeContainer === overContainer) return

    // Move item to new category group live
    setItems((prev) =>
      prev.map((item) =>
        item.id === active.id
          ? { ...item, category: overContainer === UNCATEGORIZED ? null : overContainer }
          : item
      )
    )
    setOverId(over.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over || active.id === over.id) return

    const activeContainer = dragOriginContainer.current ?? findContainer(active.id as string)
    const overContainer = findContainer(over.id as string) ?? activeContainer

    if (!activeContainer || !overContainer) return

    const currentItems = itemsRef.current

    if (activeContainer === overContainer) {
      // Same-group reorder
      const groupItems = currentItems.filter(
        (i) => (i.category ?? UNCATEGORIZED) === activeContainer
      )
      const sorted = [...groupItems].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const oldIndex = sorted.findIndex((i) => i.id === active.id)
      const newIndex = sorted.findIndex((i) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(sorted, oldIndex, newIndex)

      // Update parent state
      setItems((prev) => {
        const byId = new Map(reordered.map((item, i) => [item.id, { ...item, position: i }]))
        return prev.map((item) => byId.get(item.id) ?? item)
      })

      // Persist separately — never inside setState callback
      void persistPositions(reordered)
    } else {
      // Cross-group: category already updated in onDragOver — persist new category + positions
      const newCategory = overContainer === UNCATEGORIZED ? null : overContainer
      const sourceContainer = activeContainer

      const updateCategory = async () => {
        const { error } = await supabase
          .from("grocery_items")
          .update({ category: newCategory })
          .eq("id", active.id as string)
        if (error) {
          toast.error("Failed to move item")
          return
        }

        // Persist positions for BOTH source and destination groups
        const destItems = itemsRef.current.filter(
          (i) => (i.category ?? UNCATEGORIZED) === overContainer
        )
        const sourceItems = itemsRef.current.filter(
          (i) => (i.category ?? UNCATEGORIZED) === sourceContainer && i.id !== active.id
        )
        await Promise.all([
          persistPositions(destItems),
          persistPositions(sourceItems),
        ])
      }

      void updateCategory()
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      quantity: 1,
      unit: "",
      category: "",
      in_pantry: view === "pantry",
      low_threshold: null,
      expiry_date: null,
    },
  })

  function openAdd(presetCategory?: string) {
    form.reset({
      name: "",
      quantity: 1,
      unit: "",
      category: presetCategory ?? "",
      in_pantry: view === "pantry",
      low_threshold: null,
      expiry_date: null,
    })
    setEditing(null)
    setOpen(true)
  }

  function handleAddCategory() {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    if (customCategories.includes(trimmed) || categories.includes(trimmed)) {
      toast.error("Category already exists")
      return
    }
    setCustomCategories((prev) => [...prev, trimmed])
    setNewCategoryName("")
    setCategoryDialogOpen(false)
    toast.success(`Category "${trimmed}" added`)
  }

  function openEdit(item: GroceryItem) {
    form.reset({
      name: item.name,
      quantity: Number(item.quantity),
      unit: item.unit ?? "",
      category: item.category ?? "",
      in_pantry: item.in_pantry,
      low_threshold: item.low_threshold != null ? Number(item.low_threshold) : null,
      expiry_date: item.expiry_date ?? null,
    })
    setEditing(item)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      quantity: values.quantity,
      unit: values.unit || null,
      category: values.category || null,
      in_pantry: values.in_pantry,
      low_threshold: values.low_threshold ?? null,
      expiry_date: values.expiry_date || null,
    }

    if (editing) {
      const { data, error } = await supabase
        .from("grocery_items")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single()
      if (error) {
        toast.error("Failed to update item")
        return
      }
      setItems((prev) => prev.map((i) => (i.id === editing.id ? data : i)))
      toast.success("Item updated")
    } else {
      const { data, error } = await supabase
        .from("grocery_items")
        .insert(payload)
        .select()
        .single()
      if (error) {
        toast.error("Failed to add item")
        return
      }
      setItems((prev) => [...prev, data])
      toast.success("Item added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("grocery_items").delete().eq("id", id)
    if (error) {
      toast.error("Failed to delete item")
      setDeleting(null)
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast.success("Item deleted")
    setDeleting(null)
  }

  async function handleTogglePantry(item: GroceryItem) {
    setMoving(item.id)
    const newInPantry = !item.in_pantry

    const { data, error } = await supabase
      .from("grocery_items")
      .update({ in_pantry: newInPantry })
      .eq("id", item.id)
      .select()
      .single()

    if (error) {
      toast.error("Failed to move item")
      setMoving(null)
      return
    }

    await supabase.from("pantry_log").insert({
      item_id: item.id,
      user_id: userId,
      action: newInPantry ? "added" : "removed",
      quantity: Number(item.quantity),
    })

    setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)))
    toast.success(newInPantry ? "Moved to pantry" : "Added back to shopping list")
    setMoving(null)
  }

  async function handleCheck(item: GroceryItem) {
    const newChecked = !item.checked
    const { data, error } = await supabase
      .from("grocery_items")
      .update({ checked: newChecked } as never)
      .eq("id", item.id)
      .select()
      .single()
    if (error) {
      toast.error("Failed to update item")
      return
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)))
  }

  async function handleMoveCheckedToPantry() {
    const checkedItems = viewItems.filter((i) => i.checked)
    if (checkedItems.length === 0) return

    await Promise.all(
      checkedItems.map(async (item) => {
        const { data, error } = await supabase
          .from("grocery_items")
          .update({ in_pantry: true, checked: false } as never)
          .eq("id", item.id)
          .select()
          .single()
        if (!error && data) {
          await supabase.from("pantry_log").insert({
            item_id: item.id,
            user_id: userId,
            action: "added",
            quantity: Number(item.quantity),
          })
          setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)))
        }
      })
    )
    toast.success(`Moved ${checkedItems.length} item${checkedItems.length === 1 ? "" : "s"} to pantry`)
  }

  async function handleStepQuantity(item: GroceryItem, delta: number) {
    const newQty = Math.max(0, Number(item.quantity) + delta)
    const { data, error } = await supabase
      .from("grocery_items")
      .update({ quantity: newQty })
      .eq("id", item.id)
      .select()
      .single()
    if (error) {
      toast.error("Failed to update quantity")
      return
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)))
  }

  // Active item for DragOverlay
  const activeItem = activeId ? itemsRef.current.find((i) => i.id === activeId) : null

  // All item ids for DndContext
  const allIds = useMemo(() => viewItems.map((i) => i.id), [viewItems])

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {view === "shopping" ? (
            <ShoppingCart className="size-4 text-muted-foreground" />
          ) : (
            <Package className="size-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground font-medium">
            {viewItems.length} {viewItems.length === 1 ? "item" : "items"}
          </span>
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {view === "shopping" && checkedCount > 0 && (
            <Button size="sm" variant="secondary" onClick={handleMoveCheckedToPantry}>
              Move to pantry ({checkedCount})
            </Button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openAdd()}>
              <ListPlus className="size-4 mr-2" /> Add Item
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCategoryDialogOpen(true)}>
              <FolderPlus className="size-4 mr-2" /> Add Category
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* List */}
      {viewItems.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          {view === "shopping"
            ? "Shopping list is empty — add items to pick up."
            : "Pantry is empty — move items here after shopping."}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          No items match the selected category.
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
            {groups.map(([groupKey, groupItems]) => {
              const isCollapsed = collapsedGroups.has(groupKey)
              return (
                <div key={groupKey} className="space-y-1">
                  {/* Group header */}
                  <button
                    className="flex items-center gap-1.5 w-full text-left py-1.5 text-xs font-semibold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                    onClick={() => toggleGroup(groupKey)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="size-3.5 shrink-0" />
                    )}
                    <span>{groupKey}</span>
                    <span className="font-normal normal-case tracking-normal text-muted-foreground">
                      ({groupItems.length})
                    </span>
                  </button>

                  {!isCollapsed && (
                    <SortableContext
                      items={groupItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {groupItems.map((item) => (
                          <SortableRow
                            key={item.id}
                            item={item}
                            view={view}
                            isMoving={moving === item.id}
                            isDeleting={deleting === item.id}
                            onCheck={handleCheck}
                            onTogglePantry={handleTogglePantry}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onStepQuantity={handleStepQuantity}
                            isLowStock={isLowStock}
                            isExpiringSoon={isExpiringSoon}
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
              <SortableRow
                item={activeItem}
                view={view}
                isMoving={false}
                isDeleting={false}
                onCheck={() => {}}
                onTogglePantry={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onStepQuantity={() => {}}
                isLowStock={isLowStock}
                isExpiringSoon={isExpiringSoon}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Item Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Whole milk" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("quantity", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input placeholder="e.g. lbs, oz, pk" {...form.register("unit")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                placeholder="e.g. Produce"
                list="grocery-category-options"
                {...form.register("category")}
              />
              <datalist id="grocery-category-options">
                {allCategoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Low stock threshold</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1"
                  {...form.register("low_threshold", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry date</Label>
                <Input type="date" {...form.register("expiry_date")} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="in_pantry"
                className="size-4 rounded"
                {...form.register("in_pantry")}
              />
              <Label htmlFor="in_pantry" className="font-normal cursor-pointer">
                In pantry (already have it)
              </Label>
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

      {/* Add Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddCategory()
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Category name</Label>
              <Input
                placeholder="e.g. Snacks, Frozen, Personal Care"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newCategoryName.trim()}>
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
