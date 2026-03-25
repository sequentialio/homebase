"use client"

import { useState } from "react"
import { MessageSquare, BookOpen, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { AssistantContent } from "./assistant-content"
import { KnowledgeTab } from "./knowledge-tab"
import { DevRequestsTab } from "./dev-requests-tab"

interface AssistantPageContentProps {
  userName: string
  userId: string
  initialDocs: any[]
  initialDevRequests: any[]
}

export function AssistantPageContent({
  userName,
  userId,
  initialDocs,
  initialDevRequests,
}: AssistantPageContentProps) {
  const [tab, setTab] = useState<"chat" | "knowledge" | "dev">("chat")

  const openCount = initialDevRequests.filter((r: any) => r.status === "open").length

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 shrink-0">
        <button
          onClick={() => setTab("chat")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            tab === "chat"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <MessageSquare className="size-3.5" />
          Chat
        </button>
        <button
          onClick={() => setTab("knowledge")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            tab === "knowledge"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <BookOpen className="size-3.5" />
          Knowledge
        </button>
        <button
          onClick={() => setTab("dev")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            tab === "dev"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Wrench className="size-3.5" />
          Dev Requests
          {openCount > 0 && (
            <span className={cn(
              "inline-flex items-center justify-center rounded-full w-4 h-4 text-[10px] font-bold",
              tab === "dev"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary text-primary-foreground"
            )}>
              {openCount}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab === "chat" ? (
          <AssistantContent userName={userName} />
        ) : tab === "knowledge" ? (
          <KnowledgeTab userId={userId} initialDocs={initialDocs} />
        ) : (
          <DevRequestsTab userId={userId} initialRequests={initialDevRequests} />
        )}
      </div>
    </div>
  )
}
