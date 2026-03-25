"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Send,
  Plus,
  Trash2,
  ArrowLeft,
  List,
  MessageCircle,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ── Types ───────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
}

interface SharedListItem {
  id: string
  list_id: string
  title: string
  checked: boolean
  due_date: string | null
  assigned_to: string | null
  position: number
}

interface SharedList {
  id: string
  name: string
  icon: string | null
  color: string | null
  position: number
  shared_list_items: SharedListItem[]
}

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface TogetherContentProps {
  userId: string
  initialMessages: Message[]
  initialLists: SharedList[]
  profiles: Profile[]
}

// ── Component ───────────────────────────────────────────────────────────────────

export function TogetherContent({
  userId,
  initialMessages,
  initialLists,
  profiles,
}: TogetherContentProps) {
  const supabase = useMemo(() => createClient(), [])

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="chat" className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border px-4">
          <TabsList className="!h-auto py-1 gap-1">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageCircle className="size-4 sm:mr-0" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="lists" className="gap-1.5">
              <List className="size-4 sm:mr-0" />
              <span className="hidden sm:inline">Lists</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden">
          <ChatTab
            userId={userId}
            initialMessages={initialMessages}
            profiles={profiles}
            supabase={supabase}
          />
        </TabsContent>

        <TabsContent value="lists" className="flex-1 mt-0 overflow-hidden">
          <ListsTab
            userId={userId}
            initialLists={initialLists}
            profiles={profiles}
            supabase={supabase}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Chat Tab ────────────────────────────────────────────────────────────────────

function ChatTab({
  userId,
  initialMessages,
  profiles,
  supabase,
}: {
  userId: string
  initialMessages: Message[]
  profiles: Profile[]
  supabase: ReturnType<typeof createClient>
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Realtime subscription
  useEffect(() => {
    const channel = (supabase as any)
      .channel("household-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "household_messages" },
        (payload: { new: Message }) => {
          setMessages((prev) => {
            // Deduplicate by id
            if (prev.some((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new as Message]
          })
        }
      )
      .subscribe()

    return () => {
      (supabase as any).removeChannel(channel)
    }
  }, [supabase])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const getProfile = useCallback(
    (senderId: string) => profiles.find((p) => p.id === senderId),
    [profiles]
  )

  const getFirstName = useCallback(
    (senderId: string) => {
      const profile = getProfile(senderId)
      if (!profile?.full_name) return "User"
      return profile.full_name.split(" ")[0]
    },
    [getProfile]
  )

  const getInitials = useCallback(
    (senderId: string) => {
      const profile = getProfile(senderId)
      if (!profile?.full_name) return "?"
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    },
    [getProfile]
  )

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput("")

    const { error } = await (supabase as any)
      .from("household_messages")
      .insert({ sender_id: userId, content: text })

    if (error) {
      toast.error("Failed to send message")
      setInput(text)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <MessageCircle className="size-10 mb-3 opacity-30" />
            <p>No messages yet. Say something!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === userId
          const profile = getProfile(msg.sender_id)
          return (
            <div
              key={msg.id}
              className={cn("flex gap-2.5", isMe && "flex-row-reverse")}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "flex items-center justify-center size-8 rounded-full shrink-0 mt-0.5 overflow-hidden text-xs font-semibold",
                  isMe
                    ? "bg-[var(--brand-lime)] text-black"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="size-8 rounded-full object-cover"
                  />
                ) : (
                  getInitials(msg.sender_id)
                )}
              </div>

              {/* Bubble */}
              <div
                className={cn(
                  "flex flex-col max-w-[80%] md:max-w-[65%]",
                  isMe && "items-end"
                )}
              >
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isMe ? "You" : getFirstName(msg.sender_id)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {formatRelativeTime(msg.created_at)}
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    isMe
                      ? "bg-primary/20 border border-primary/30 text-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sending}
            autoComplete="off"
          />
          <Button
            size="icon"
            className="shrink-0 bg-[var(--brand-lime)] text-black hover:bg-[var(--brand-lime)]/80 disabled:opacity-30"
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Lists Tab ───────────────────────────────────────────────────────────────────

function ListsTab({
  userId,
  initialLists,
  profiles,
  supabase,
}: {
  userId: string
  initialLists: SharedList[]
  profiles: Profile[]
  supabase: ReturnType<typeof createClient>
}) {
  const [lists, setLists] = useState<SharedList[]>(initialLists)
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [newListName, setNewListName] = useState("")
  const [creatingList, setCreatingList] = useState(false)

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) ?? null,
    [lists, activeListId]
  )

  async function handleCreateList() {
    const name = newListName.trim()
    if (!name || creatingList) return
    setCreatingList(true)

    const maxPos = lists.reduce((max, l) => Math.max(max, l.position), -1)

    const { data, error } = await (supabase as any)
      .from("shared_lists")
      .insert({ name, position: maxPos + 1 })
      .select("*, shared_list_items(*)")
      .single()

    if (error) {
      toast.error("Failed to create list")
    } else {
      setLists((prev) => [...prev, data])
      setNewListName("")
      toast.success("List created")
    }
    setCreatingList(false)
  }

  async function handleDeleteList(listId: string) {
    const { error } = await (supabase as any)
      .from("shared_lists")
      .delete()
      .eq("id", listId)

    if (error) {
      toast.error("Failed to delete list")
      return
    }
    setLists((prev) => prev.filter((l) => l.id !== listId))
    if (activeListId === listId) setActiveListId(null)
    toast.success("List deleted")
  }

  function updateListItems(listId: string, updater: (items: SharedListItem[]) => SharedListItem[]) {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, shared_list_items: updater(l.shared_list_items) }
          : l
      )
    )
  }

  // ── Grid view ─────────────────────────────────────────────────────────────

  if (!activeList) {
    return (
      <div className="overflow-y-auto h-full px-4 py-4 space-y-4">
        {/* Create list */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateList()
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="New list name..."
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newListName.trim() || creatingList}
          >
            <Plus className="size-4 mr-1" />
            Create
          </Button>
        </form>

        {lists.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            <List className="size-10 mx-auto mb-3 opacity-30" />
            <p>No shared lists yet. Create one above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lists.map((list) => {
              const unchecked = list.shared_list_items.filter(
                (i) => !i.checked
              ).length
              const checked = list.shared_list_items.filter(
                (i) => i.checked
              ).length
              return (
                <button
                  key={list.id}
                  onClick={() => setActiveListId(list.id)}
                  className="group relative rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm truncate">
                      {list.name}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!size-7 !min-h-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteList(list.id)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {unchecked > 0 && (
                      <span>
                        {unchecked} to do
                      </span>
                    )}
                    {checked > 0 && (
                      <span className="text-muted-foreground/50">
                        {checked} done
                      </span>
                    )}
                    {unchecked === 0 && checked === 0 && (
                      <span>Empty</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Detail view ───────────────────────────────────────────────────────────

  return (
    <ListDetail
      list={activeList}
      profiles={profiles}
      supabase={supabase}
      onBack={() => setActiveListId(null)}
      onUpdateItems={(updater) => updateListItems(activeList.id, updater)}
    />
  )
}

// ── List Detail ─────────────────────────────────────────────────────────────────

function ListDetail({
  list,
  profiles,
  supabase,
  onBack,
  onUpdateItems,
}: {
  list: SharedList
  profiles: Profile[]
  supabase: ReturnType<typeof createClient>
  onBack: () => void
  onUpdateItems: (updater: (items: SharedListItem[]) => SharedListItem[]) => void
}) {
  const [newItemTitle, setNewItemTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uncheckedItems = useMemo(
    () =>
      list.shared_list_items
        .filter((i) => !i.checked)
        .sort((a, b) => a.position - b.position),
    [list.shared_list_items]
  )

  const checkedItems = useMemo(
    () =>
      list.shared_list_items
        .filter((i) => i.checked)
        .sort((a, b) => a.position - b.position),
    [list.shared_list_items]
  )

  async function handleAddItem() {
    const title = newItemTitle.trim()
    if (!title || adding) return
    setAdding(true)

    const maxPos = list.shared_list_items.reduce(
      (max, i) => Math.max(max, i.position),
      -1
    )

    const { data, error } = await (supabase as any)
      .from("shared_list_items")
      .insert({
        list_id: list.id,
        title,
        checked: false,
        position: maxPos + 1,
      })
      .select()
      .single()

    if (error) {
      toast.error("Failed to add item")
    } else {
      onUpdateItems((prev) => [...prev, data])
      setNewItemTitle("")
      inputRef.current?.focus()
    }
    setAdding(false)
  }

  async function handleToggleItem(item: SharedListItem) {
    const newChecked = !item.checked

    const { error } = await (supabase as any)
      .from("shared_list_items")
      .update({ checked: newChecked })
      .eq("id", item.id)

    if (error) {
      toast.error("Failed to update item")
      return
    }
    onUpdateItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: newChecked } : i))
    )
  }

  async function handleDeleteItem(itemId: string) {
    const { error } = await (supabase as any)
      .from("shared_list_items")
      .delete()
      .eq("id", itemId)

    if (error) {
      toast.error("Failed to delete item")
      return
    }
    onUpdateItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  const getAssigneeName = (assignedTo: string | null) => {
    if (!assignedTo) return null
    const profile = profiles.find((p) => p.id === assignedTo)
    return profile?.full_name?.split(" ")[0] ?? null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="!size-8 !min-h-0 text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="font-semibold text-sm truncate">{list.name}</h2>
        <Badge variant="secondary" className="ml-auto text-xs">
          {uncheckedItems.length} remaining
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Add item */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleAddItem()
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Add an item..."
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            disabled={!newItemTitle.trim() || adding}
          >
            <Plus className="size-4" />
          </Button>
        </form>

        {/* Unchecked items */}
        {uncheckedItems.length === 0 && checkedItems.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            No items yet. Add one above.
          </div>
        )}

        {uncheckedItems.length > 0 && (
          <div className="space-y-1">
            {uncheckedItems.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                onToggle={() => handleToggleItem(item)}
                onDelete={() => handleDeleteItem(item.id)}
                assigneeName={getAssigneeName(item.assigned_to)}
              />
            ))}
          </div>
        )}

        {/* Checked items */}
        {checkedItems.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider pt-2">
              Done ({checkedItems.length})
            </p>
            {checkedItems.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                onToggle={() => handleToggleItem(item)}
                onDelete={() => handleDeleteItem(item.id)}
                assigneeName={getAssigneeName(item.assigned_to)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── List Item Row ───────────────────────────────────────────────────────────────

function ListItemRow({
  item,
  onToggle,
  onDelete,
  assigneeName,
}: {
  item: SharedListItem
  onToggle: () => void
  onDelete: () => void
  assigneeName: string | null
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 group",
        item.checked && "opacity-50"
      )}
    >
      <Checkbox
        checked={item.checked}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm",
            item.checked && "line-through text-muted-foreground"
          )}
        >
          {item.title}
        </span>
        {(item.due_date || assigneeName) && (
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {item.due_date && (
              <span>
                Due{" "}
                {new Date(item.due_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {assigneeName && (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {assigneeName}
              </span>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="!size-7 !min-h-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

// ── Utilities ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) return "yesterday"
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}
