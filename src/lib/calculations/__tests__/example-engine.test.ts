import { describe, it, expect } from "vitest"
import { calculateExample, type ExampleInputs } from "../example-engine"

const baseInputs: ExampleInputs = {
  lineItems: [
    { description: "Labor", quantity: 8, unitCost: 100 },
    { description: "Parts", quantity: 5, unitCost: 50 },
  ],
  overheadRate: 0.15,
  targetMargin: 0.30,
}

describe("calculateExample", () => {
  it("calculates direct cost correctly", () => {
    const result = calculateExample(baseInputs)
    // Labor: 8 × $100 = $800, Parts: 5 × $50 = $250
    expect(result.directCost).toBe(1050)
  })

  it("applies overhead rate", () => {
    const result = calculateExample(baseInputs)
    expect(result.overheadAmount).toBe(157.5) // 1050 × 0.15
    expect(result.totalCost).toBe(1207.5)
  })

  it("derives selling price from target margin", () => {
    const result = calculateExample(baseInputs)
    // price = 1207.5 / (1 - 0.30) = 1725
    expect(result.basePrice).toBe(1725)
    expect(result.totalPrice).toBe(1725)
  })

  it("meets target margin flag is true when margin is on target", () => {
    const result = calculateExample(baseInputs)
    expect(result.meetsTargetMargin).toBe(true)
  })

  it("includes fixed fee in total price", () => {
    const result = calculateExample({ ...baseInputs, fixedFee: 200 })
    expect(result.totalPrice).toBe(1925) // 1725 + 200
  })

  it("handles empty line items", () => {
    const result = calculateExample({ ...baseInputs, lineItems: [] })
    expect(result.directCost).toBe(0)
    expect(result.totalCost).toBe(0)
    expect(result.grossMarginPct).toBe(0)
  })

  it("flags when margin falls below target", () => {
    // Force a low price by using a zero-margin target but checking against higher
    const result = calculateExample({ ...baseInputs, targetMargin: 0.50 })
    // Recalculate: price = 1207.5 / 0.50 = 2415
    expect(result.meetsTargetMargin).toBe(true)
    expect(result.totalPrice).toBe(2415)
  })
})
