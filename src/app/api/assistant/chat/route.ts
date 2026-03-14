/**
 * AI Assistant — Streaming Chat API Route
 *
 * Provides a Claude-powered assistant with tool use over SSE.
 * The client sends a message history; the server injects a rich system
 * prompt built from the user's data and streams back events.
 *
 * SETUP:
 * 1. Add ANTHROPIC_API_KEY to .env
 * 2. Replace the example tool definitions with your domain's tools
 * 3. Replace buildSystemPrompt() and context builders with your data
 * 4. In next.config.ts: serverExternalPackages: ['@anthropic-ai/sdk']
 *
 * Pattern from homebase app — generalized for reuse.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import { buildExampleContext } from "@/lib/assistant/example-context"

export const maxDuration = 120

// ── Tool definitions ──────────────────────────────────────────────
// SETUP: replace these with your domain's tools.
// Each tool must have: name, description, input_schema (JSON Schema object).

const EXAMPLE_SAVE_TOOL: Anthropic.Tool = {
  name: "save_record",
  description:
    "Save a new record extracted from the user's message or an uploaded document. " +
    "The user will see the extracted data and can confirm before it's saved.",
  input_schema: {
    type: "object" as const,
    properties: {
      table_name: {
        type: "string",
        description: "Which database table to save the record to",
      },
      fields: {
        type: "object",
        description: "Key-value pairs matching the table schema",
      },
      summary: {
        type: "string",
        description: "Brief human-readable summary of what will be saved",
      },
    },
    required: ["table_name", "fields", "summary"],
  },
}

const EXAMPLE_UPDATE_TOOL: Anthropic.Tool = {
  name: "update_record",
  description:
    "Update an existing record. Match by a unique field, then provide fields to update.",
  input_schema: {
    type: "object" as const,
    properties: {
      table_name: {
        type: "string",
        description: "Which table contains the record",
      },
      match_field: {
        type: "string",
        description: "The field to match on (e.g. 'name', 'id')",
      },
      match_value: {
        type: "string",
        description: "The value to match",
      },
      updates: {
        type: "object",
        description: "Key-value pairs of fields to update",
      },
      summary: {
        type: "string",
        description: "Brief human-readable summary of what was updated",
      },
    },
    required: ["table_name", "match_field", "match_value", "updates", "summary"],
  },
}

// ── System prompt ─────────────────────────────────────────────────
// SETUP: replace with your app's role, rules, and injected context.

function buildSystemPrompt(context: string): string {
  return `You are an intelligent assistant for [YOUR APP NAME]. You have access to the user's data and can help them manage, update, and analyze it.

RULES:
- Only discuss the user's own data shown below.
- Be concise but thorough. Use bullet points and formatting for clarity.
- When you identify data that should be saved or updated, use the appropriate tool.
- Always confirm actions in a summary after tool calls.
- You are not a licensed professional advisor — include brief disclaimers where appropriate.

USER DATA:
${context}`
}

// ── Types ─────────────────────────────────────────────────────────

interface ClientMessage {
  role: "user" | "assistant"
  content: string
  images?: { data: string; mediaType: string }[]
  toolUse?: { id: string; name: string; input: unknown }
}

// ── Route handler ─────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Parse body
  let body: { messages?: ClientMessage[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { messages } = body
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 })
  }

  // 3. Build context
  // SETUP: replace buildExampleContext() with your domain's context builder(s).
  // Run them in parallel with Promise.all if you have multiple domains.
  const context = await buildExampleContext(supabase, user.id)

  // 4. Convert messages to Anthropic format (supports text + images + tool_use)
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => {
    if (msg.role === "user") {
      if (msg.images && msg.images.length > 0) {
        const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
        const imageBlocks = msg.images.map((img) => {
          const mediaType = validTypes.includes(img.mediaType as any)
            ? (img.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif")
            : "image/png"
          return {
            type: "image" as const,
            source: { type: "base64" as const, media_type: mediaType, data: img.data },
          }
        })
        return {
          role: "user" as const,
          content: [
            ...imageBlocks,
            { type: "text" as const, text: msg.content || "Please analyze this document." },
          ],
        }
      }
      return { role: "user" as const, content: msg.content }
    }

    // Assistant message — may include tool_use blocks
    if (msg.toolUse) {
      return {
        role: "assistant" as const,
        content: [
          ...(msg.content ? [{ type: "text" as const, text: msg.content }] : []),
          {
            type: "tool_use" as const,
            id: msg.toolUse.id,
            name: msg.toolUse.name,
            input: msg.toolUse.input,
          },
        ],
      }
    }
    return { role: "assistant" as const, content: msg.content }
  })

  // 5. Stream
  try {
    const anthropic = new Anthropic()
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: buildSystemPrompt(context),
      tools: [EXAMPLE_SAVE_TOOL, EXAMPLE_UPDATE_TOOL],
      messages: anthropicMessages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (err) {
          console.error("Stream error:", err)
          let errorMsg = "Stream error"
          if (err instanceof Error) {
            try {
              const jsonMatch = err.message.match(/\{.*\}/)
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                errorMsg = parsed?.error?.message || err.message
              } else {
                errorMsg = err.message
              }
            } catch {
              errorMsg = err.message
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMsg })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    console.error("Chat API error:", err)
    let message = "Chat failed"
    if (err instanceof Error) {
      try {
        const jsonMatch = err.message.match(/\{.*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          message = parsed?.error?.message || err.message
        } else {
          message = err.message
        }
      } catch {
        message = err.message
      }
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
