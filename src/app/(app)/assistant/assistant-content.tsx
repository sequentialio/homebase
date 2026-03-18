"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import {
  ArrowUp, Paperclip, X, User, Loader2, Zap,
  Plus, Menu, PanelRightClose, PanelRightOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImageAttachment {
  data: string
  mediaType: string
  previewUrl: string
  name: string
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  images?: ImageAttachment[]
  imageCount?: number   // for messages loaded from DB (no previewUrl)
  toolCalls?: string[]
  streaming?: boolean
}

interface StoredMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: string[]
  imageCount?: number
}

interface ChatSession {
  id: string
  title: string
  messages: StoredMessage[]
  created_at: string
  updated_at: string
}

interface AssistantContentProps {
  userId: string
  userName: string
  initialSessions: ChatSession[]
}

function storedToMessages(stored: StoredMessage[]): Message[] {
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    toolCalls: m.toolCalls,
    imageCount: m.imageCount,
    streaming: false,
  }))
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssistantContent({ userId, userName, initialSessions }: AssistantContentProps) {
  const supabase = useMemo(() => createClient(), [])

  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialSessions[0]?.id ?? null
  )
  const [messages, setMessages] = useState<Message[]>(() =>
    initialSessions[0] ? storedToMessages(initialSessions[0].messages) : []
  )
  const [showSessions, setShowSessions] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)

  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<string[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Use ref so saveSession callback always has current value without re-creating
  const currentSessionIdRef = useRef(currentSessionId)
  useEffect(() => { currentSessionIdRef.current = currentSessionId }, [currentSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeTools])

  // ── Session management ─────────────────────────────────────────────────────

  function selectSession(session: ChatSession) {
    setCurrentSessionId(session.id)
    currentSessionIdRef.current = session.id
    setMessages(storedToMessages(session.messages))
    setInput("")
    setAttachments([])
    setShowSessions(false)
  }

  function startNewChat() {
    setCurrentSessionId(null)
    currentSessionIdRef.current = null
    setMessages([])
    setInput("")
    setAttachments([])
    setShowSessions(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const saveSession = useCallback(async (finalMessages: Message[]) => {
    const stored: StoredMessage[] = finalMessages
      .filter((m) => !m.streaming)
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
        imageCount: (m.images?.length || m.imageCount) || undefined,
      }))

    const sid = currentSessionIdRef.current

    if (!sid) {
      const firstUser = finalMessages.find((m) => m.role === "user")
      const title = firstUser?.content.trim().slice(0, 60) || "New Chat"
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({ user_id: userId, title, messages: stored as unknown as import("@/types/database").Json })
        .select("id, title, messages, created_at, updated_at")
        .single()
      if (error || !data) return
      currentSessionIdRef.current = data.id
      setCurrentSessionId(data.id)
      setSessions((prev) => [data as unknown as ChatSession, ...prev])
    } else {
      const { data } = await supabase
        .from("chat_sessions")
        .update({ messages: stored as unknown as import("@/types/database").Json, updated_at: new Date().toISOString() })
        .eq("id", sid)
        .select("id, title, messages, created_at, updated_at")
        .single()
      if (data) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sid ? (data as unknown as ChatSession) : s))
        )
      }
    }
  }, [supabase, userId])

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"]
      const results: ImageAttachment[] = []
      for (const file of files) {
        if (!validTypes.includes(file.type)) {
          toast.error(`${file.name} is not a supported image type`)
          continue
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 5 MB limit`)
          continue
        }
        const data = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(",")[1])
          reader.readAsDataURL(file)
        })
        results.push({ data, mediaType: file.type, previewUrl: URL.createObjectURL(file), name: file.name })
      }
      setAttachments((prev) => [...prev, ...results])
      e.target.value = ""
    },
    []
  )

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text && attachments.length === 0) return
    if (isStreaming) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      images: attachments.length > 0 ? [...attachments] : undefined,
    }
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      streaming: true,
      toolCalls: [],
    }

    const nextMessages = [...messages, userMsg, assistantMsg]
    setMessages(nextMessages)
    setInput("")
    setAttachments([])
    setIsStreaming(true)
    setActiveTools([])

    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
      images: m.images?.map((img) => ({ data: img.data, mediaType: img.mediaType })),
    }))

    let finalMessages = nextMessages

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error(err.error ?? "Request failed")
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim()
          if (!line) continue
          try {
            const event = JSON.parse(line)
            if (event.type === "delta") {
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + event.text } : m
                )
                finalMessages = updated
                return updated
              })
            } else if (event.type === "tool_start") {
              setActiveTools((prev) => [...prev, event.name])
            } else if (event.type === "tool_done") {
              setActiveTools((prev) => prev.filter((n) => n !== event.name))
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), event.name] }
                    : m
                )
                finalMessages = updated
                return updated
              })
            } else if (event.type === "done") {
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, streaming: false } : m
                )
                finalMessages = updated
                return updated
              })
            } else if (event.type === "error") {
              throw new Error(event.message)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      toast.error(msg)
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false }
            : m
        )
        finalMessages = updated
        return updated
      })
    } finally {
      setIsStreaming(false)
      setActiveTools([])
      await saveSession(finalMessages)
    }
  }, [input, attachments, isStreaming, messages, saveSession])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">

      {/* Mobile backdrop */}
      {showSessions && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setShowSessions(false)}
        />
      )}

      {/* ── Chat area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          {/* Mobile sessions toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden !size-8 !min-h-0 text-muted-foreground"
            onClick={() => setShowSessions((v) => !v)}
          >
            <Menu className="size-4" />
          </Button>

          <Image src="/logos/claude-logo.png" alt="Claude" width={22} height={22} className="object-contain shrink-0" />

          <span className="font-semibold text-sm truncate">
            {currentSessionId
              ? (sessions.find((s) => s.id === currentSessionId)?.title ?? "Claude")
              : "Claude"}
          </span>

          <div className="flex items-center gap-1 ml-auto">
            {/* Desktop: toggle sessions panel */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex !size-8 !min-h-0 text-muted-foreground hover:text-foreground"
              onClick={() => setSessionsOpen((v) => !v)}
              title={sessionsOpen ? "Hide chats" : "Show chats"}
            >
              {sessionsOpen
                ? <PanelRightClose className="size-4" />
                : <PanelRightOpen className="size-4" />}
            </Button>
            {/* New chat */}
            <Button
              variant="ghost"
              size="icon"
              className="!size-8 !min-h-0 text-muted-foreground hover:text-foreground"
              onClick={startNewChat}
              title="New chat"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {/* Hidden file input — shared by both layouts */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {messages.length === 0 ? (
          /* ── Empty state: greeting + input centered ── */
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-8">
            <EmptyState userName={userName} />
            <div className="w-full max-w-2xl">
              <InputCard
                attachments={attachments}
                input={input}
                isStreaming={isStreaming}
                textareaRef={textareaRef}
                onInputChange={setInput}
                onKeyDown={handleKeyDown}
                onAttachClick={() => fileInputRef.current?.click()}
                onRemoveAttachment={removeAttachment}
                onSend={sendMessage}
              />
            </div>
          </div>
        ) : (
          /* ── Active chat: messages scroll + input pinned bottom ── */
          <>
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {activeTools.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-10">
                  <Loader2 className="size-3 animate-spin" />
                  {activeTools.map((t) => (
                    <span key={t} className="bg-muted px-2 py-0.5 rounded-full">
                      {formatToolName(t)}
                    </span>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 px-3 md:px-5 py-3">
              <InputCard
                attachments={attachments}
                input={input}
                isStreaming={isStreaming}
                textareaRef={textareaRef}
                onInputChange={setInput}
                onKeyDown={handleKeyDown}
                onAttachClick={() => fileInputRef.current?.click()}
                onRemoveAttachment={removeAttachment}
                onSend={sendMessage}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Sessions sidebar (right side on desktop, slide-from-right on mobile) ── */}
      <aside className={cn(
        "flex flex-col shrink-0 border-l border-border bg-sidebar text-sidebar-foreground overflow-hidden transition-all duration-200",
        "fixed inset-y-0 right-0 z-30 md:static md:z-auto md:translate-x-0",
        showSessions ? "translate-x-0 w-64" : "translate-x-full w-64 md:translate-x-0",
        sessionsOpen ? "md:w-64" : "md:w-0 md:border-l-0",
        "md:top-auto top-[calc(3.5rem+env(safe-area-inset-top))]",
        "bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-auto"
      )}>
        <div className="h-14 flex items-center px-3 border-b border-border shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
            onClick={startNewChat}
          >
            <Plus className="size-4" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-sidebar-foreground/40 text-center py-8 px-3">
              No conversations yet
            </p>
          )}
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => selectSession(session)}
              className={cn(
                "w-full text-left rounded-md px-3 py-2 text-sm transition-colors",
                currentSessionId === session.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <div className="truncate font-medium leading-snug">{session.title}</div>
              <div className="text-[10px] opacity-50 mt-0.5">
                {formatRelativeDate(session.updated_at)}
              </div>
            </button>
          ))}
        </div>
      </aside>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "flex items-center justify-center size-7 rounded-full shrink-0 mt-0.5",
        isUser ? "bg-[var(--brand-lime)] text-black" : "bg-muted text-muted-foreground"
      )}>
        {isUser ? (
          <User className="size-3.5" />
        ) : (
          <Image src="/logos/claude-logo.png" alt="Claude" width={16} height={16} className="object-contain" />
        )}
      </div>

      <div className={cn("flex flex-col gap-1 max-w-[85%] md:max-w-[75%]", isUser && "items-end")}>
        {/* Live image previews (new messages) */}
        {message.images && message.images.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {message.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img.previewUrl}
                alt="attachment"
                className="h-20 w-20 object-cover rounded-md border border-border"
              />
            ))}
          </div>
        )}
        {/* Loaded-from-DB image indicator */}
        {!message.images && (message.imageCount ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
            <Paperclip className="size-3" />
            {message.imageCount} image{message.imageCount! > 1 ? "s" : ""} attached
          </div>
        )}

        {(message.content || message.streaming) && (
          <div className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isUser ? "bg-[var(--brand-lime)] text-black" : "bg-muted text-foreground"
          )}>
            {message.content ? (
              <FormattedMessage content={message.content} />
            ) : (
              <span className="inline-flex gap-1">
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
              </span>
            )}
            {message.streaming && message.content && (
              <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {message.toolCalls.map((t, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 border border-border/50 rounded-full px-2 py-0.5"
              >
                <Zap className="size-2.5 text-[var(--brand-lime)]" />
                {formatToolName(t)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function EmptyState({ userName }: { userName: string }) {
  const greeting = getGreeting()
  return (
    <div className="flex flex-col items-center justify-center text-center select-none">
      <div className="flex items-center gap-4">
        <Image
          src="/logos/claude-logo.png"
          alt="Claude"
          width={52}
          height={52}
          className="object-contain opacity-90"
        />
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-4xl md:text-5xl font-light tracking-tight text-foreground/90">
          {greeting}, {userName}
        </h1>
      </div>
    </div>
  )
}

// ── InputCard sub-component ────────────────────────────────────────────────────

interface InputCardProps {
  attachments: { previewUrl: string; name: string }[]
  input: string
  isStreaming: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onInputChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onAttachClick: () => void
  onRemoveAttachment: (i: number) => void
  onSend: () => void
}

function InputCard({
  attachments, input, isStreaming, textareaRef,
  onInputChange, onKeyDown, onAttachClick, onRemoveAttachment, onSend,
}: InputCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card px-2 py-2 flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap px-1">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.previewUrl}
                alt={att.name}
                className="h-14 w-14 object-cover rounded-md border border-border"
              />
              <button
                onClick={() => onRemoveAttachment(i)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full size-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything about your household…"
        className="resize-none min-h-[36px] max-h-[160px] text-sm py-1 px-2 border-0 shadow-none focus-visible:ring-0 bg-transparent"
        rows={1}
        disabled={isStreaming}
      />

      <div className="flex items-center justify-between px-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onAttachClick}
          disabled={isStreaming}
          title="Attach image (e.g. receipt)"
        >
          <Plus className="size-5" />
        </Button>

        <Button
          size="icon"
          className="size-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-30"
          onClick={onSend}
          disabled={isStreaming || (!input.trim() && attachments.length === 0)}
        >
          {isStreaming
            ? <Loader2 className="size-4 animate-spin" />
            : <ArrowUp className="size-5" />}
        </Button>
      </div>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split("\n")
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return (
          <p key={i} className="font-semibold text-sm mt-2 first:mt-0">{line.slice(3)}</p>
        )
        if (line.startsWith("### ")) return (
          <p key={i} className="font-medium text-xs mt-1.5 first:mt-0 uppercase tracking-wide opacity-70">{line.slice(4)}</p>
        )
        if (line.startsWith("- ") || line.startsWith("• ")) return (
          <p key={i} className="pl-3 relative before:content-['•'] before:absolute before:left-0">{renderInline(line.slice(2))}</p>
        )
        if (!line.trim() && i > 0 && i < lines.length - 1) return <br key={i} />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </>
  )
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`")) return (
      <code key={i} className="bg-black/10 dark:bg-white/10 rounded px-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>
    )
    return part
  })
}

function formatToolName(name: string): string {
  const labels: Record<string, string> = {
    get_finances: "Finances",
    get_pantry_and_grocery: "Pantry",
    get_cleaning_duties: "Cleaning",
    get_calendar_events: "Calendar",
    log_transaction: "Logging transaction",
    add_to_shopping_list: "Adding to list",
    add_calendar_event: "Adding event",
  }
  return labels[name] ?? name
}
