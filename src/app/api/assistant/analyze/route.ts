/**
 * AI Vision — Document Analysis API Route
 *
 * Accepts a base64-encoded image, sends it to Claude Vision,
 * and returns structured JSON data extracted from the document.
 *
 * Use this when you want OCR / document parsing as a separate step
 * (as opposed to in-line tool use in the chat route).
 *
 * SETUP:
 * 1. Add ANTHROPIC_API_KEY to .env
 * 2. Update SYSTEM_PROMPT with your document schema
 * 3. Update the JSON schema below to match your extraction targets
 * 4. In next.config.ts: serverExternalPackages: ['@anthropic-ai/sdk']
 *
 * Pattern from homebase app — generalized for reuse.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"
import { checkRateLimit } from "@/lib/rate-limit"

// Allow large base64 payloads (up to ~10 MB images)
export const maxDuration = 60

// ── System prompt ─────────────────────────────────────────────────
// SETUP: replace with a schema describing YOUR document types.
// Claude will return strict JSON matching this schema.

const SYSTEM_PROMPT = `You are a document analysis assistant. Your job is to extract structured data from screenshots of documents.

You MUST respond with valid JSON only. No explanatory text outside the JSON.

The JSON must conform to this schema:
{
  "document_type": "invoice" | "receipt" | "contract" | "form" | "unknown",
  "confidence": "high" | "medium" | "low",
  "summary": "brief human-readable description of what you found",
  "data": {
    // SETUP: define the fields relevant to your document types.
    // Example:
    "vendor": "string or null",
    "date": "YYYY-MM-DD or null",
    "total": "number or null",
    "line_items": [
      {
        "description": "string",
        "quantity": "number or null",
        "unit_price": "number or null",
        "amount": "number"
      }
    ]
  }
}

Rules:
- Set confidence to "low" if the image is blurry, partially visible, or unclear.
- Set document_type to "unknown" if you cannot identify the document.
- For numbers, extract raw numeric values (no $ signs or commas).
- For dates, use YYYY-MM-DD format.
- If a field is not visible, set it to null rather than guessing.`

const EXTRACTION_PROMPT =
  "Analyze this document. Extract all relevant data and return it as structured JSON matching the schema described in your instructions."

// ── Route handler ─────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await checkRateLimit(`${user.id}:/api/assistant/analyze`, { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  // 2. Parse request body
  let body: { image?: string; mediaType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { image, mediaType } = body
  if (!image || !mediaType) {
    return NextResponse.json({ error: "image and mediaType are required" }, { status: 400 })
  }

  const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"]
  if (!validTypes.includes(mediaType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 })
  }

  // Validate image size (~1.37x base64 overhead, reject >10MB)
  const estimatedBytes = Math.ceil(image.length * 3 / 4)
  if (estimatedBytes > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 })
  }

  // 3. Call Claude Vision
  try {
    const anthropic = new Anthropic()

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                data: image,
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    })

    // 4. Extract text block
    const textBlock = response.content.find((c) => c.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from AI" }, { status: 500 })
    }

    // 5. Parse JSON — Claude sometimes wraps in ```json ... ```
    const raw = textBlock.text
      .replace(/^```json\s*\n?/, "")
      .replace(/\n?\s*```$/, "")
      .trim()

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, user_id: user.id, data: parsed })
  } catch (err) {
    console.error("[assistant/analyze] Error:", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: "AI analysis failed" },
      { status: 500 }
    )
  }
}
