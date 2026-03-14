/**
 * Example Calculation Engine
 *
 * Architecture pattern used across Sequential Analytics apps.
 *
 * Key principles:
 * - Pure TypeScript — no framework dependencies, no side effects
 * - Takes an inputs object, returns a breakdown object
 * - Every intermediate value is exposed in the output (for display + debugging)
 * - Fully testable with Vitest (see __tests__/example-engine.test.ts)
 * - Business logic lives here, not in form components
 *
 * To adapt for a new project:
 * 1. Rename the file to match your domain (e.g. quote-engine.ts, pricing-engine.ts)
 * 2. Replace ExampleInputs with your input fields
 * 3. Replace ExampleResult with your output fields
 * 4. Implement calculateExample() with your formulas
 * 5. Add tests in __tests__/
 */

// ── Input types ──────────────────────────────────────────────────

export interface LineItem {
  description: string
  quantity: number
  unitCost: number
}

export interface ExampleInputs {
  lineItems: LineItem[]
  /** Overhead rate as a decimal, e.g. 0.15 = 15% */
  overheadRate: number
  /** Target gross margin as a decimal, e.g. 0.30 = 30% */
  targetMargin: number
  /** Optional fixed fee added on top */
  fixedFee?: number
}

// ── Output types ─────────────────────────────────────────────────

export interface ExampleResult {
  // Inputs echoed for display
  lineItems: LineItem[]
  overheadRate: number
  targetMargin: number

  // Calculated subtotals
  directCost: number
  overheadAmount: number
  totalCost: number

  // Pricing
  fixedFee: number
  /** Selling price derived from targetMargin: price = totalCost / (1 - margin) */
  basePrice: number
  totalPrice: number

  // Margin analysis
  grossProfit: number
  /** Actual gross margin percentage (0–1) */
  grossMarginPct: number
  /** Whether the result meets the target margin */
  meetsTargetMargin: boolean
}

// ── Engine ───────────────────────────────────────────────────────

export function calculateExample(inputs: ExampleInputs): ExampleResult {
  const { lineItems, overheadRate, targetMargin, fixedFee = 0 } = inputs

  // Direct cost: sum of all line items
  const directCost = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  )

  // Overhead
  const overheadAmount = directCost * overheadRate
  const totalCost = directCost + overheadAmount

  // Selling price from margin: price = cost / (1 - margin)
  // Handles edge case: if margin >= 1 (impossible), clamp to 0.99
  const effectiveMargin = Math.min(targetMargin, 0.99)
  const basePrice = effectiveMargin >= 1 ? totalCost : totalCost / (1 - effectiveMargin)

  const totalPrice = basePrice + fixedFee

  // Margin analysis
  const grossProfit = totalPrice - totalCost
  const grossMarginPct = totalPrice > 0 ? grossProfit / totalPrice : 0
  const meetsTargetMargin = grossMarginPct >= targetMargin - 0.001 // 0.1% tolerance

  return {
    lineItems,
    overheadRate,
    targetMargin,
    directCost: round(directCost),
    overheadAmount: round(overheadAmount),
    totalCost: round(totalCost),
    fixedFee: round(fixedFee),
    basePrice: round(basePrice),
    totalPrice: round(totalPrice),
    grossProfit: round(grossProfit),
    grossMarginPct: roundPct(grossMarginPct),
    meetsTargetMargin,
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/** Round to 2 decimal places (currency) */
function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Round to 4 decimal places (percentage) */
function roundPct(n: number): number {
  return Math.round(n * 10000) / 10000
}
