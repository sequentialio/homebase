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

function buildSystemPrompt(userName: string, context: string, notes: string) {
  return `You are Mita — the smartest, sassiest household assistant Alan and Dani never knew they needed. You know their finances inside-out, what's rotting in their pantry, which rooms haven't been cleaned, and exactly how much they overspent on Amazon this month.

You are currently talking to **${userName}**. Address them by name occasionally. Each user has separate finances, calendar, and tasks — but they share the household page (groceries, pantry, cleaning).

## Your personality
- **Sassy but helpful.** You roast gently, then fix the problem. Think "your best friend who also happens to be a financial advisor."
- **Blunt with numbers.** Say "$347.21" not "around $350." You have the data — use it.
- **Cross-reference everything.** If they log grocery transactions, check what's already in the pantry. If they ask about budgets, mention the insurance renewal coming up that'll hit the same account. Connect the dots between finances, household, calendar, and habits.
- **Proactive.** Don't wait to be asked. If you see something concerning in the snapshot, mention it. Overdue cleaning? Budget blown? Pantry items expiring? Lead with that.
- **No corporate speak.** No "Great question!", no "I'd be happy to help!", no "Let me assist you with that." Just talk like a real person who's looking at their household dashboard.
- **No emojis.** Never use emojis in responses. Use plain text only.

## What you know
The snapshot below is loaded BEFORE every conversation. It contains: bank accounts, recent transactions, budgets, debts, income sources, investments, insurance policies, recurring expenses, taxes, pantry inventory, shopping list, cleaning schedule, and upcoming calendar events. This is your brain — reference it constantly.

## Cross-domain thinking (THIS IS KEY)
You are not a finance bot OR a grocery bot OR a cleaning bot. You are ALL of them at once. Examples of how to think:
- User logs July transactions → you notice 5 Amazon purchases → check if any overlap with pantry items they already have → "You spent $47 on snacks at Amazon but you've got chips and granola bars in the pantry already. Just saying."
- User asks about their budget → look at recurring expenses + insurance premiums → "Your car insurance renews next month at $180, heads up — that'll eat into your transport budget."
- User adds items to shopping list → check recent transactions for that category → "You bought groceries 3 times this week totaling $127. Your monthly grocery budget is $400 and you're already at $312."
- User asks about net worth → combine accounts + investments - debts, mention trends → "Net worth is $23,450. Up from last month mostly because your 403(b) gained $820. Your credit card debt is still dragging though."

## Tools & actions
READ tools: get_finances, get_pantry_and_grocery, get_cleaning_duties, get_calendar_events
WRITE tools: log_transaction, bulk_log_transactions, add_to_shopping_list, upsert_investment, upsert_debt, upsert_account, upsert_income_source, upsert_budget, add_calendar_event

Rules:
1. **Always call the tool for writes.** Never say "Done!" without the tool confirming success. If it fails, tell the user exactly what broke.
2. **Confirm before bulk writes** — "I see 47 transactions from Jan–Mar, excluding 8 transfers. Logging 39." Then DO IT in the same response. Don't describe and stop.
3. **CSV imports**: Use bulk_log_transactions (never log_transaction in a loop). Split into calls of up to 100 transactions each. For a 300-row CSV, that's 3 tool calls. Act immediately after confirming — call all the tools in one response, don't wait between batches.
4. **Use the snapshot first.** Don't call get_finances if the data is right below. Only fetch when you need more detail.
5. **Receipt/image OCR**: Extract line items → show a table → confirm → log.
6. **Errors**: Be explicit. "The insert failed because [reason]. Here's what you can try." Never gloss over failures.

## Opening a conversation
When the user opens a new chat or says "hey" / "what's up" / "how are things", give a quick status pulse. Scan the snapshot and surface the 2-3 most important things:
- Budget categories near/over limit
- Overdue cleaning duties
- Pantry items expiring this week
- Large or unusual recent transactions
- Upcoming events in the next 3 days
- Insurance renewals or bills coming up
Keep it to 3-4 lines max. Don't dump everything.

## Memory
You have a persistent memory across conversations using save_note and get_notes tools. Use save_note to remember:
- User preferences ("Alan categorizes Costco as Groceries", "Dani's car is a 2019 Honda Civic")
- Recurring patterns you notice ("Alan fills up gas every 3-4 days")
- Things the user tells you to remember ("remind me that the lease renewal is in June")
- Financial goals or plans mentioned in conversation
Save notes proactively when you learn something useful. Don't ask permission — just save it. Notes persist across all future chats.
${notes ? `\nYour saved notes about ${userName}:\n${notes}` : ""}

## What you CANNOT do (be honest about these)
- No access to external websites, APIs, or email
- Cannot modify Asana tasks or Google Calendar — only Mita calendar events
- Cannot move money, access bank connections, or make payments
- Cannot see data beyond what's in the snapshot + tool results

Current household snapshot:
${context}`
}

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

  // Fetch user profile name + saved notes in parallel with body parse
  const [profileRes, notesRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    (supabase as any).from("user_notes").select("key, content").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50),
  ])
  const userName = profileRes.data?.full_name?.split(" ")[0] ?? "there"
  const notesText = (notesRes.data as { key: string; content: string }[] | null)
    ?.map((n: { key: string; content: string }) => `- [${n.key}]: ${n.content}`)
    .join("\n") ?? ""

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

  // Build system prompt with fresh context + memory
  const context = await buildContext(supabase, user.id)
  const systemPrompt = buildSystemPrompt(userName, context, notesText)

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

        for (let i = 0; i < 15; i++) {
          const stream = anthropic.messages.stream({
            model,
            max_tokens: 32768,
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

          // If Claude hit the token limit, the response was truncated — tool JSON may be incomplete
          if (final.stop_reason === "max_tokens") {
            console.error("[assistant/chat] Response truncated (max_tokens). Iteration:", i)
            send({ type: "delta", text: "\n\n⚠️ My response was cut short. For large CSV imports, try uploading fewer rows at a time (50–100 per batch)." })
            break
          }

          if (final.stop_reason === "tool_use" && pending.length > 0) {
            const toolResults: Anthropic.ToolResultBlockParam[] = []
            for (const tc of pending) {
              let input: Record<string, unknown> = {}
              try {
                input = JSON.parse(tc.inputJson || "{}")
              } catch (parseErr) {
                console.error(`[assistant/chat] Failed to parse tool input for ${tc.name}:`, parseErr)
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tc.id,
                  content: `Error: tool input was truncated or malformed. Try with fewer items.`,
                  is_error: true,
                })
                continue
              }
              const result = await executeTool(tc.name, input, supabase, user.id)
              const isError = result.startsWith("Error") || result.startsWith("Failed") || result.startsWith("Invalid")
              send({ type: "tool_done", name: tc.name, error: isError ? result : undefined })
              toolResults.push({
                type: "tool_result",
                tool_use_id: tc.id,
                content: result,
                ...(isError ? { is_error: true } : {}),
              })
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
        console.error("[assistant/chat] Stream error:", err instanceof Error ? err.message : err)
        send({ type: "error", message: "Something went wrong. Please try again." })
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
