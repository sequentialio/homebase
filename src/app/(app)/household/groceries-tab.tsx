"use client"

import { useMemo, useState } from "react"
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
import type { Tables } from "@/types/database"

type GroceryItem = Tables<"grocery_items">

const GROCERY_CATEGORIES = [
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

export function GroceriesTab({ userId, items, setItems, view }: GroceriesTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GroceryItem | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const viewItems = useMemo(
    () => items.filter((i) => (view === "shopping" ? !i.in_pantry : i.in_pantry)),
    [items, view]
  )

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return viewItems
    return viewItems.filter((i) => i.category === categoryFilter)
  }, [viewItems, categoryFilter])

  const categories = useMemo(() => {
    const cats = new Set(viewItems.map((i) => i.category).filter(Boolean) as string[])
    return Array.from(cats).sort()
  }, [viewItems])

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

  function openAdd() {
    form.reset({
      name: "",
      quantity: 1,
      unit: "",
      category: "",
      in_pantry: view === "pantry",
      low_threshold: null,
      expiry_date: null,
    })
    setEditing(null)
    setOpen(true)
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
      if (error) { toast.error("Failed to update item"); return }
      setItems((prev) => prev.map((i) => (i.id === editing.id ? data : i)))
      toast.success("Item updated")
    } else {
      const { data, error } = await supabase
        .from("grocery_items")
        .insert(payload)
        .select()
        .single()
      if (error) { toast.error("Failed to add item"); return }
      setItems((prev) => [...prev, data])
      toast.success("Item added")
    }
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await supabase.from("grocery_items").delete().eq("id", id)
    if (error) { toast.error("Failed to delete item"); setDeleting(null); return }
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

    if (error) { toast.error("Failed to move item"); setMoving(null); return }

    // Log to pantry_log
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

  const isLowStock = (item: GroceryItem) =>
    item.in_pantry &&
    item.low_threshold != null &&
    Number(item.quantity) <= Number(item.low_threshold)

  const isExpiringSoon = (item: GroceryItem) => {
    if (!item.expiry_date) return false
    const days = (new Date(item.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days <= 7
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
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
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          {viewItems.length === 0
            ? view === "shopping"
              ? "Shopping list is empty — add items to pick up."
              : "Pantry is empty — move items here after shopping."
            : "No items match the selected category."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{item.name}</span>
                  {isLowStock(item) && (
                    <Badge variant="outline" className="text-xs text-yellow-600 dark:text-yellow-400 border-yellow-400/50 gap-1">
                      <AlertTriangle className="size-3" /> Low
                    </Badge>
                  )}
                  {isExpiringSoon(item) && (
                    <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400 border-red-400/50 gap-1">
                      <AlertTriangle className="size-3" /> Expiring
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  {Number(item.quantity) > 0 && (
                    <span>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ""}</span>
                  )}
                  {item.category && <span>· {item.category}</span>}
                  {item.expiry_date && (
                    <span>· Expires {formatDate(item.expiry_date)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="!size-7 !min-h-0 text-muted-foreground hover:text-foreground"
                  title={view === "shopping" ? "Move to pantry" : "Back to list"}
                  onClick={() => handleTogglePantry(item)}
                  disabled={moving === item.id}
                >
                  <ArrowLeftRight className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="!size-7 !min-h-0"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
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
              <Select
                value={form.watch("category") ?? ""}
                onValueChange={(v) => form.setValue("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {GROCERY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
