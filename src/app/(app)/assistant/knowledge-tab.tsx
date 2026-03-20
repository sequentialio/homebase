"use client"

import { useState, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, FileText, FolderOpen,
  ChevronRight, Search, ArrowLeft,
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
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type KnowledgeDoc = {
  id: string
  user_id: string
  title: string
  content: string
  category: string
  created_at: string
  updated_at: string
}

interface KnowledgeTabProps {
  userId: string
  initialDocs: KnowledgeDoc[]
}

// ── Default categories ────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  "General",
  "Insurance",
  "Financial Advice",
  "Tax Reference",
  "Legal",
  "Medical",
  "Work",
  "Personal",
]

// ── Component ────────────────────────────────────────────────────────────────

export function KnowledgeTab({ userId, initialDocs }: KnowledgeTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const [docs, setDocs] = useState<KnowledgeDoc[]>(initialDocs)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDoc | null>(null)
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTitle, setDialogTitle] = useState("")
  const [dialogContent, setDialogContent] = useState("")
  const [dialogCategory, setDialogCategory] = useState("General")
  const [customCategory, setCustomCategory] = useState("")
  const [useCustomCategory, setUseCustomCategory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Computed
  const categories = useMemo(() => {
    const cats = new Set(docs.map((d) => d.category))
    DEFAULT_CATEGORIES.forEach((c) => cats.add(c))
    return Array.from(cats).sort()
  }, [docs])

  const filtered = useMemo(() => {
    let result = docs
    if (categoryFilter !== "all") {
      result = result.filter((d) => d.category === categoryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      )
    }
    return result.sort((a, b) => a.title.localeCompare(b.title))
  }, [docs, categoryFilter, search])

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, KnowledgeDoc[]> = {}
    for (const doc of filtered) {
      if (!groups[doc.category]) groups[doc.category] = []
      groups[doc.category].push(doc)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // ── CRUD ──────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingDoc(null)
    setDialogTitle("")
    setDialogContent("")
    setDialogCategory("General")
    setCustomCategory("")
    setUseCustomCategory(false)
    setDialogOpen(true)
  }

  function openEdit(doc: KnowledgeDoc) {
    setEditingDoc(doc)
    setDialogTitle(doc.title)
    setDialogContent(doc.content)
    const isDefault = DEFAULT_CATEGORIES.includes(doc.category)
    if (isDefault) {
      setDialogCategory(doc.category)
      setUseCustomCategory(false)
      setCustomCategory("")
    } else {
      setDialogCategory("custom")
      setUseCustomCategory(true)
      setCustomCategory(doc.category)
    }
    setDialogOpen(true)
  }

  async function handleSave() {
    const title = dialogTitle.trim()
    if (!title) { toast.error("Title is required"); return }

    const category = useCustomCategory ? customCategory.trim() : dialogCategory
    if (!category) { toast.error("Category is required"); return }

    setSaving(true)

    const payload = {
      user_id: userId,
      title,
      content: dialogContent,
      category,
      updated_at: new Date().toISOString(),
    }

    if (editingDoc) {
      const { data, error } = await (supabase as any)
        .from("knowledge_docs")
        .update(payload)
        .eq("id", editingDoc.id)
        .select()
        .single()
      setSaving(false)
      if (error) { toast.error("Failed to update"); return }
      setDocs((prev) => prev.map((d) => (d.id === editingDoc.id ? data : d)))
      if (viewingDoc?.id === editingDoc.id) setViewingDoc(data)
      toast.success("Document updated")
    } else {
      const { data, error } = await (supabase as any)
        .from("knowledge_docs")
        .insert(payload)
        .select()
        .single()
      setSaving(false)
      if (error) { toast.error("Failed to create"); return }
      setDocs((prev) => [...prev, data])
      toast.success("Document added")
    }
    setDialogOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await (supabase as any)
      .from("knowledge_docs")
      .delete()
      .eq("id", id)
    setDeleting(null)
    if (error) { toast.error("Failed to delete"); return }
    setDocs((prev) => prev.filter((d) => d.id !== id))
    if (viewingDoc?.id === id) setViewingDoc(null)
    toast.success("Document deleted")
  }

  // ── Doc viewer ────────────────────────────────────────────────────────────

  if (viewingDoc) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-4 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="!size-8 !min-h-0"
            onClick={() => setViewingDoc(null)}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm truncate">{viewingDoc.title}</h2>
            <p className="text-xs text-muted-foreground">{viewingDoc.category}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => openEdit(viewingDoc)}>
            <Pencil className="size-3.5 mr-1" /> Edit
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {viewingDoc.content || (
              <p className="text-muted-foreground italic">No content yet</p>
            )}
          </div>
        </div>

        {/* Edit dialog */}
        <DocDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={!!editingDoc}
          title={dialogTitle}
          setTitle={setDialogTitle}
          content={dialogContent}
          setContent={setDialogContent}
          category={dialogCategory}
          setCategory={setDialogCategory}
          customCategory={customCategory}
          setCustomCategory={setCustomCategory}
          useCustomCategory={useCustomCategory}
          setUseCustomCategory={setUseCustomCategory}
          categories={categories}
          saving={saving}
          onSave={handleSave}
        />
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-4 border-b shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base">Knowledge Base</h2>
          <p className="text-xs text-muted-foreground">
            {docs.length} document{docs.length !== 1 ? "s" : ""} &middot; The assistant can search and read these
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4 mr-1" /> Add Document
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 p-4 pb-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search docs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-4">
        {groupedByCategory.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            {docs.length === 0
              ? "No documents yet. Add your first one to get started."
              : "No documents match your search."}
          </div>
        )}

        {groupedByCategory.map(([category, catDocs]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="size-3.5 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                {category}
              </span>
              <span className="text-xs text-muted-foreground">({catDocs.length})</span>
            </div>
            <div className="space-y-1.5 ml-5">
              {catDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-accent/5 cursor-pointer group"
                  onClick={() => setViewingDoc(doc)}
                >
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.content.slice(0, 80) || "No content"}
                      {doc.content.length > 80 ? "..." : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!size-7 !min-h-0"
                      onClick={(e) => { e.stopPropagation(); openEdit(doc) }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!size-7 !min-h-0 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.id) }}
                      disabled={deleting === doc.id}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit dialog */}
      <DocDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={!!editingDoc}
        title={dialogTitle}
        setTitle={setDialogTitle}
        content={dialogContent}
        setContent={setDialogContent}
        category={dialogCategory}
        setCategory={setDialogCategory}
        customCategory={customCategory}
        setCustomCategory={setCustomCategory}
        useCustomCategory={useCustomCategory}
        setUseCustomCategory={setUseCustomCategory}
        categories={categories}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  )
}

// ── Dialog sub-component ──────────────────────────────────────────────────────

function DocDialog({
  open,
  onOpenChange,
  editing,
  title,
  setTitle,
  content,
  setContent,
  category,
  setCategory,
  customCategory,
  setCustomCategory,
  useCustomCategory,
  setUseCustomCategory,
  categories,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: boolean
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  category: string
  setCategory: (v: string) => void
  customCategory: string
  setCustomCategory: (v: string) => void
  useCustomCategory: boolean
  setUseCustomCategory: (v: boolean) => void
  categories: string[]
  saving: boolean
  onSave: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Document" : "Add Document"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. BCBS PPO Policy Details"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={useCustomCategory ? "custom" : category}
              onValueChange={(v) => {
                if (v === "custom") {
                  setUseCustomCategory(true)
                } else {
                  setUseCustomCategory(false)
                  setCategory(v)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="custom">+ Custom category</SelectItem>
              </SelectContent>
            </Select>
            {useCustomCategory && (
              <Input
                placeholder="Enter custom category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="mt-1.5"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Content (Markdown)</Label>
            <Textarea
              placeholder="Paste your markdown content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="font-mono text-xs resize-y"
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
