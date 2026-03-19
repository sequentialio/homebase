import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { buildContext } from "@/lib/assistant/context"
import { toolDefinitions, executeTool } from "@/lib/assistant/tools"

export const maxDuration = 120

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PREFIX = `You are Mita Assistant — a smart, friendly AI for a 2-person household (you + Dani). You help with finances, groceries, household planning, and scheduling.

You have access to real household data (provided below as a snapshot) and tools to query more detail or take actions: logging transactions, adding to the shopping list, creating calendar events, etc.

Guidelines:
- Be concise and practical. No filler.
- When numbers matter, be precise.
- If the user uploads a receipt image, extract all line items and confirm before logging.
- Use tools proactively when asked about data not in the snapshot.
- Confirm any write actions (logged transaction, added item, etc.) with a brief summary.

Current household snapshot:\n`

interface IncomingMessage {
  role: "user" | "assistant"
  content: string
  images?: { data: string; mediaType: string }[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await checkRateLimit(`${user.id}:/api/assistant/chat`, { limit: 20, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let body: { messages?: IncomingMessage[]; model?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { messages } = body
  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 })
  }

  const ALLOWED_MODELS = ["claude-opus-4-6", "claude-sonnet-4-5"]
  const model = ALLOWED_MODELS.includes(body.model ?? "") ? body.model! : "claude-sonnet-4-5"

  // Build system prompt with fresh context
  const context = await buildContext(supabase, user.id)
  const systemPrompt = SYSTEM_PREFIX + context

  // Convert incoming messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => {
    if (msg.role === "user" && msg.images?.length) {
      const validTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
      ] as const
      type ValidType = (typeof validTypes)[number]
      const imageBlocks: Anthropic.ImageBlockParam[] = msg.images.map((img) => ({
        type: "image",
        source: {
          type: "base64",
          media_type: validTypes.includes(img.mediaType as ValidType)
            ? (img.mediaType as ValidType)
            : "image/jpeg",
          data: img.data,
        },
      }))
      return {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: msg.content || "Please analyze this image." },
        ],
      }
    }
    return { role: msg.role, content: msg.content }
  })

  // SSE stream with agentic tool loop
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        let currentMessages = [...anthropicMessages]

        for (let i = 0; i < 10; i++) {
          const stream = anthropic.messages.stream({
            model,
            max_tokens: 4096,
            ...(model === "claude-opus-4-6" ? { thinking: { type: "enabled", budget_tokens: 2000 } } : {}),
            system: systemPrompt,
            tools: toolDefinitions,
            messages: currentMessages,
          })

          // Track tool calls in this iteration
          const pending: Array<{ id: string; name: string; inputJson: string }> = []
          let activeId = ""
          let activeName = ""
          let activeJson = ""
          let isThinkingBlock = false

          for await (const event of stream) {
            if (
              event.type === "content_block_start" &&
              event.content_block.type === "thinking"
            ) {
              isThinkingBlock = true
              send({ type: "thinking_start" })
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "thinking_delta"
            ) {
              send({ type: "thinking_delta", text: event.delta.thinking })
            } else if (event.type === "content_block_stop" && isThinkingBlock) {
              isThinkingBlock = false
              send({ type: "thinking_done" })
            } else if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              activeId = event.content_block.id
              activeName = event.content_block.name
              activeJson = ""
              send({ type: "tool_start", name: activeName })
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "input_json_delta"
            ) {
              activeJson += event.delta.partial_json
            } else if (event.type === "content_block_stop" && activeId) {
              pending.push({ id: activeId, name: activeName, inputJson: activeJson })
              activeId = ""
              activeName = ""
              activeJson = ""
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "delta", text: event.delta.text })
            }
          }

          const final = await stream.finalMessage()

          if (final.stop_reason === "end_turn") break

          if (final.stop_reason === "tool_use" && pending.length > 0) {
            const toolResults: Anthropic.ToolResultBlockParam[] = []
            for (const tc of pending) {
              let input: Record<string, unknown> = {}
              try { input = JSON.parse(tc.inputJson || "{}") } catch { /* ok */ }
              const result = await executeTool(tc.name, input, supabase, user.id)
              send({ type: "tool_done", name: tc.name })
              toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: result })
            }
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: final.content },
              { role: "user", content: toolResults },
            ]
          } else {
            break
          }
        }

        send({ type: "done" })
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Stream error" })
      } finally {
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
}
