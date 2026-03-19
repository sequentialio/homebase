"use client"

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

// ── Shared types ───────────────────────────────────────────────────────────────

export interface ImageAttachment {
  data: string
  mediaType: string
  previewUrl: string
  name: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  images?: ImageAttachment[]
  imageCount?: number
  csvFiles?: string[]        // display-only: filenames attached
  toolCalls?: string[]
  thinking?: string
  streamingThinking?: boolean
  streaming?: boolean
}

export interface StoredMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: string[]
  imageCount?: number
  csvFiles?: string[]
}

export interface ChatSession {
  id: string
  title: string
  messages: StoredMessage[]
  created_at: string
  updated_at: string
}

export function storedToMessages(stored: StoredMessage[]): Message[] {
  return stored.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    toolCalls: m.toolCalls,
    imageCount: m.imageCount,
    csvFiles: m.csvFiles,
    streaming: false,
  }))
}

// ── Context ────────────────────────────────────────────────────────────────────

export type AssistantModel = "claude-opus-4-6" | "claude-sonnet-4-5"

interface AssistantContextValue {
  messages: Message[]
  setMessages: Dispatch<SetStateAction<Message[]>>
  sessions: ChatSession[]
  setSessions: Dispatch<SetStateAction<ChatSession[]>>
  currentSessionId: string | null
  setCurrentSessionId: Dispatch<SetStateAction<string | null>>
  isStreaming: boolean
  activeTools: string[]
  model: AssistantModel
  setModel: (m: AssistantModel) => void
  sendMessage: (text: string, images: ImageAttachment[], csvFiles?: { name: string; content: string }[]) => Promise<void>
  selectSession: (session: ChatSession) => void
  startNewChat: (focusCb?: () => void) => void
}

const AssistantContext = createContext<AssistantContextValue | null>(null)

export function useAssistant() {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider")
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────────

interface AssistantProviderProps {
  userId: string
  children: ReactNode
}

export function AssistantProvider({ userId, children }: AssistantProviderProps) {
  const supabase = useMemo(() => createClient(), [])

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<string[]>([])
  const [model, setModelState] = useState<AssistantModel>(() => {
    if (typeof window === "undefined") return "claude-sonnet-4-5"
    return (localStorage.getItem("assistant_model") as AssistantModel) ?? "claude-sonnet-4-5"
  })

  const setModel = useCallback((m: AssistantModel) => {
    setModelState(m)
    localStorage.setItem("assistant_model", m)
  }, [])

  // Ref so saveSession always closes over the current session ID
  const currentSessionIdRef = useRef<string | null>(null)
  useEffect(() => { currentSessionIdRef.current = currentSessionId }, [currentSessionId])

  // Fetch sessions on mount (once userId is available)
  useEffect(() => {
    if (!userId) return
    supabase
      .from("chat_sessions")
      .select("id, title, messages, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data?.length) {
          const typed = data as unknown as ChatSession[]
          setSessions(typed)
          setCurrentSessionId(typed[0].id)
          setMessages(storedToMessages(typed[0].messages))
          currentSessionIdRef.current = typed[0].id
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Session persistence ────────────────────────────────────────────────────

  const saveSession = useCallback(async (finalMessages: Message[]) => {
    const stored: StoredMessage[] = finalMessages
      .filter((m) => !m.streaming)
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
        imageCount: (m.images?.length || m.imageCount) || undefined,
        csvFiles: m.csvFiles?.length ? m.csvFiles : undefined,
      }))

    const sid = currentSessionIdRef.current

    if (!sid) {
      const firstUser = finalMessages.find((m) => m.role === "user")
      const title = firstUser?.content.trim().slice(0, 60) || "New Chat"
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: userId,
          title,
          messages: stored as unknown as import("@/types/database").Json,
        })
        .select("id, title, messages, created_at, updated_at")
        .single()
      if (error || !data) return
      currentSessionIdRef.current = data.id
      setCurrentSessionId(data.id)
      setSessions((prev) => [data as unknown as ChatSession, ...prev])
    } else {
      const { data } = await supabase
        .from("chat_sessions")
        .update({
          messages: stored as unknown as import("@/types/database").Json,
          updated_at: new Date().toISOString(),
        })
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

  // ── Send message & stream ──────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string, images: ImageAttachment[], csvFiles?: { name: string; content: string }[]) => {
    if (!text && images.length === 0 && !csvFiles?.length) return
    if (isStreaming) return

    // CSV content is sent to the API but not stored in the displayed message
    const csvBlock = csvFiles?.length
      ? "\n\n" + csvFiles.map((c) => `[Attached file: ${c.name}]\n\`\`\`csv\n${c.content}\n\`\`\``).join("\n\n")
      : ""

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,   // display text only — no CSV dump
      images: images.length > 0 ? images : undefined,
      csvFiles: csvFiles?.length ? csvFiles.map((c) => c.name) : undefined,
    }
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      streaming: true,
      toolCalls: [],
    }

    let finalMessages: Message[] = []

    setMessages((prev) => {
      const next = [...prev, userMsg, assistantMsg]
      finalMessages = next
      return next
    })
    setIsStreaming(true)
    setActiveTools([])

    // Build history for API — last user message gets CSV content appended
    const historySnapshot = [...messages, userMsg]
    const history = historySnapshot.map((m, i) => ({
      role: m.role,
      content: i === historySnapshot.length - 1 ? m.content + csvBlock : m.content,
      images: m.images?.map((img) => ({ data: img.data, mediaType: img.mediaType })),
    }))

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }))
        if (res.status === 401) {
          toast.error("Session expired — please log in again.", {
            action: { label: "Log in", onClick: () => (window.location.href = "/login") },
          })
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: "Session expired. Please log in again.", streaming: false }
                : m
            )
            finalMessages = updated
            return updated
          })
          return
        }
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
            if (event.type === "thinking_start") {
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, streamingThinking: true } : m
                )
                finalMessages = updated
                return updated
              })
            } else if (event.type === "thinking_delta") {
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, thinking: (m.thinking ?? "") + event.text }
                    : m
                )
                finalMessages = updated
                return updated
              })
            } else if (event.type === "thinking_done") {
              setMessages((prev) => {
                const updated = prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, streamingThinking: false } : m
                )
                finalMessages = updated
                return updated
              })
            } else if (event.type === "delta") {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, messages, model, saveSession])

  // ── Session navigation ─────────────────────────────────────────────────────

  const selectSession = useCallback((session: ChatSession) => {
    setCurrentSessionId(session.id)
    currentSessionIdRef.current = session.id
    setMessages(storedToMessages(session.messages))
  }, [])

  const startNewChat = useCallback((focusCb?: () => void) => {
    setCurrentSessionId(null)
    currentSessionIdRef.current = null
    setMessages([])
    if (focusCb) setTimeout(focusCb, 50)
  }, [])

  return (
    <AssistantContext.Provider
      value={{
        messages, setMessages,
        sessions, setSessions,
        currentSessionId, setCurrentSessionId,
        isStreaming,
        activeTools,
        model, setModel,
        sendMessage,
        selectSession,
        startNewChat,
      }}
    >
      {children}
    </AssistantContext.Provider>
  )
}
