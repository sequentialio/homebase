"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import {
  ArrowUp, Paperclip, X, User, Loader2, Zap,
  Plus, Menu, PanelRightClose, PanelRightOpen, FileText, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  useAssistant,
  type ImageAttachment,
  type Message,
  type ChatSession,
} from "@/lib/assistant/assistant-provider"

// ── Props ──────────────────────────────────────────────────────────────────────

interface AssistantContentProps {
  userName: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AssistantContent({ userName }: AssistantContentProps) {
  const {
    messages,
    sessions,
    currentSessionId,
    isStreaming,
    activeTools,
    model,
    setModel,
    userAvatarUrl,
    sendMessage,
    selectSession,
    startNewChat,
  } = useAssistant()

  // UI-local state (safe to lose on navigate)
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ImageAttachment[]>([])
  const [csvAttachments, setCsvAttachments] = useState<{ name: string; content: string }[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, activeTools])

  // ── File handling ──────────────────────────────────────────────────────────

  const processImageFiles = useCallback(async (files: File[]) => {
    const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    const imageResults: ImageAttachment[] = []
    const csvResults: { name: string; content: string }[] = []

    for (const file of files) {
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        if (file.size > 2 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 2 MB limit`)
          continue
        }
        const content = await file.text()
        csvResults.push({ name: file.name, content })
      } else if (imageTypes.includes(file.type)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 5 MB limit`)
          continue
        }
        const data = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(",")[1])
          reader.readAsDataURL(file)
        })
        imageResults.push({ data, mediaType: file.type, previewUrl: URL.createObjectURL(file), name: file.name })
      } else {
        toast.error(`${file.name} is not a supported file type`)
      }
    }
    if (imageResults.length > 0) setAttachments((prev) => [...prev, ...imageResults])
    if (csvResults.length > 0) setCsvAttachments((prev) => [...prev, ...csvResults])
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await processImageFiles(Array.from(e.target.files ?? []))
      e.target.value = ""
    },
    [processImageFiles]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const imageFiles = Array.from(e.clipboardData.items)
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (imageFiles.length === 0) return
      e.preventDefault()
      await processImageFiles(imageFiles)
    },
    [processImageFiles]
  )

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // ── Send ───────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text && attachments.length === 0 && csvAttachments.length === 0) return
    if (isStreaming) return
    const imgs = [...attachments]
    const csvs = [...csvAttachments]
    setInput("")
    setAttachments([])
    setCsvAttachments([])
    await sendMessage(text, imgs, csvs)
  }, [input, attachments, csvAttachments, isStreaming, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSelectSession = (session: ChatSession) => {
    selectSession(session)
    setShowSessions(false)
    setInput("")
    setAttachments([])
    setCsvAttachments([])
  }

  const handleNewChat = () => {
    startNewChat(() => textareaRef.current?.focus())
    setInput("")
    setAttachments([])
    setCsvAttachments([])
    setShowSessions(false)
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

          <div className="flex items-center gap-2 ml-auto">
            {/* Model toggle */}
            <div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-xs">
              <button
                onClick={() => setModel("claude-sonnet-4-5")}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-colors",
                  model === "claude-sonnet-4-5"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sonnet
              </button>
              <button
                onClick={() => setModel("claude-opus-4-6")}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-colors",
                  model === "claude-opus-4-6"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Opus
              </button>
            </div>

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
            <Button
              variant="ghost"
              size="icon"
              className="!size-8 !min-h-0 text-muted-foreground hover:text-foreground"
              onClick={handleNewChat}
              title="New chat"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,.csv"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {messages.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-8">
            <EmptyState userName={userName} />
            <div className="w-full max-w-2xl">
              <InputCard
                attachments={attachments}
                csvAttachments={csvAttachments}
                input={input}
                isStreaming={isStreaming}
                textareaRef={textareaRef}
                onInputChange={setInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onAttachClick={() => fileInputRef.current?.click()}
                onRemoveAttachment={removeAttachment}
                onRemoveCsv={(i) => setCsvAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                onSend={handleSend}
              />
            </div>
          </div>
        ) : (
          /* ── Active chat ── */
          <>
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} userAvatarUrl={userAvatarUrl} />
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
                csvAttachments={csvAttachments}
                input={input}
                isStreaming={isStreaming}
                textareaRef={textareaRef}
                onInputChange={setInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onAttachClick={() => fileInputRef.current?.click()}
                onRemoveAttachment={removeAttachment}
                onRemoveCsv={(i) => setCsvAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                onSend={handleSend}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Sessions sidebar ── */}
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
            onClick={handleNewChat}
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
              onClick={() => handleSelectSession(session)}
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

function ThinkingBlock({ thinking, streaming }: { thinking: string; streaming?: boolean }) {
  const [open, setOpen] = useState(true)

  // Auto-collapse once streaming finishes
  useEffect(() => {
    if (!streaming && thinking) setOpen(false)
  }, [streaming, thinking])

  return (
    <div className="mb-1 rounded-lg border border-border/50 bg-muted/30 overflow-hidden text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {streaming ? (
          <Loader2 className="size-3 animate-spin shrink-0 text-[var(--brand-lime)]" />
        ) : (
          <Zap className="size-3 shrink-0 text-[var(--brand-lime)]" />
        )}
        <span className="font-medium">{streaming ? "Thinking…" : "Thought"}</span>
        <ChevronDown className={cn("size-3 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 text-muted-foreground leading-relaxed whitespace-pre-wrap border-t border-border/30 pt-2 max-h-64 overflow-y-auto">
          {thinking}
          {streaming && (
            <span className="inline-block w-0.5 h-3 bg-current ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, userAvatarUrl }: { message: Message; userAvatarUrl?: string | null }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "flex items-center justify-center size-7 rounded-full shrink-0 mt-0.5 overflow-hidden",
        isUser ? "bg-[var(--brand-lime)] text-black" : "bg-muted text-muted-foreground"
      )}>
        {isUser ? (
          userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatarUrl} alt="You" className="size-7 rounded-full object-cover" />
          ) : (
            <User className="size-3.5" />
          )
        ) : (
          <Image src="/logos/claude-logo.png" alt="Claude" width={16} height={16} className="object-contain" />
        )}
      </div>

      <div className={cn("flex flex-col gap-1 max-w-[85%] md:max-w-[75%]", isUser && "items-end")}>
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
        {!message.images && (message.imageCount ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
            <Paperclip className="size-3" />
            {message.imageCount} image{message.imageCount! > 1 ? "s" : ""} attached
          </div>
        )}
        {message.csvFiles && message.csvFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.csvFiles.map((name, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/60 border border-border/50 rounded-md px-2 py-1">
                <FileText className="size-3 shrink-0" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        )}

        {!isUser && (message.thinking || message.streamingThinking) && (
          <ThinkingBlock
            thinking={message.thinking ?? ""}
            streaming={message.streamingThinking}
          />
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

// ── InputCard ──────────────────────────────────────────────────────────────────

interface InputCardProps {
  attachments: { previewUrl: string; name: string }[]
  csvAttachments: { name: string; content: string }[]
  input: string
  isStreaming: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onInputChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onAttachClick: () => void
  onRemoveAttachment: (i: number) => void
  onRemoveCsv: (i: number) => void
  onSend: () => void
}

function InputCard({
  attachments, csvAttachments, input, isStreaming, textareaRef,
  onInputChange, onKeyDown, onPaste, onAttachClick, onRemoveAttachment, onRemoveCsv, onSend,
}: InputCardProps) {
  const hasAttachments = attachments.length > 0 || csvAttachments.length > 0
  return (
    <div className="rounded-2xl border border-border bg-card px-2 py-2 flex flex-col gap-2">
      {hasAttachments && (
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
          {csvAttachments.map((csv, i) => (
            <div key={i} className="relative group flex items-center gap-1.5 bg-muted border border-border rounded-md px-2.5 py-1.5 text-xs">
              <FileText className="size-3.5 text-muted-foreground shrink-0" />
              <span className="max-w-[120px] truncate">{csv.name}</span>
              <button
                onClick={() => onRemoveCsv(i)}
                className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" />
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
        onPaste={onPaste}
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
          disabled={isStreaming || (!input.trim() && attachments.length === 0 && csvAttachments.length === 0)}
        >
          {isStreaming
            ? <Loader2 className="size-4 animate-spin" />
            : <ArrowUp className="size-5" />}
        </Button>
      </div>
    </div>
  )
}

// ── Utilities ──────────────────────────────────────────────────────────────────

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

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatToolName(name: string): string {
  const labels: Record<string, string> = {
    get_finances: "Finances",
    get_pantry_and_grocery: "Pantry",
    get_cleaning_duties: "Cleaning",
    get_calendar_events: "Calendar",
    log_transaction: "Logging transaction",
    bulk_log_transactions: "Logging transactions",
    add_to_shopping_list: "Adding to list",
    add_calendar_event: "Adding event",
    upsert_investment: "Updating investment",
    upsert_debt: "Updating debt",
    upsert_account: "Updating account",
    upsert_income_source: "Updating income",
    upsert_budget: "Updating budget",
  }
  return labels[name] ?? name
}
