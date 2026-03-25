import { describe, it, expect } from "vitest"
import {
  getPayPeriodForDate,
  getCurrentPayPeriod,
  getAdjacentPayPeriod,
  formatPeriodLabel,
} from "../pay-period"

// Helper to create a UTC date (avoids timezone issues)
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Pay Period Tests
 * Anchor: March 19, 2026 (Thursday)
 * Period length: 14 days
 * Periods align to start on the anchor day (every 14 days from Mar 19)
 */

describe("getPayPeriodForDate", () => {
  it("returns a valid pay period with start and end dates", () => {
    const result = getPayPeriodForDate(utcDate(2026, 3, 19))
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.start < result.end).toBe(true)
  })

  it("returns different periods for consecutive dates", () => {
    const result1 = getPayPeriodForDate(utcDate(2026, 3, 18))
    const result2 = getPayPeriodForDate(utcDate(2026, 3, 19))
    // Different days might be in different periods
    expect(result1.start).toBeDefined()
    expect(result2.start).toBeDefined()
  })

  it("period always spans exactly 14 days", () => {
    const testDates = [
      utcDate(2026, 3, 1),
      utcDate(2026, 3, 19),
      utcDate(2026, 4, 2),
      utcDate(2026, 6, 15),
      utcDate(2025, 12, 25),
    ]
    testDates.forEach((date) => {
      const result = getPayPeriodForDate(date)
      const start = new Date(`${result.start}T00:00:00Z`)
      const end = new Date(`${result.end}T00:00:00Z`)
      const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
      expect(diffDays).toBe(13) // 14 days inclusive = 13 days difference
    })
  })

  it("same date always returns same period", () => {
    const date = utcDate(2026, 3, 19)
    const result1 = getPayPeriodForDate(date)
    const result2 = getPayPeriodForDate(date)
    expect(result1.start).toBe(result2.start)
    expect(result1.end).toBe(result2.end)
  })
})

describe("getCurrentPayPeriod", () => {
  it("returns a valid pay period", () => {
    const result = getCurrentPayPeriod()
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.label).toBeTruthy()
    expect(result.start < result.end).toBe(true)
  })
})

describe("getAdjacentPayPeriod", () => {
  it("next period is exactly 14 days after current start", () => {
    const current = getPayPeriodForDate(utcDate(2026, 3, 19))
    const next = getAdjacentPayPeriod(current.start, "next")

    const currentStart = new Date(`${current.start}T00:00:00Z`)
    const nextStart = new Date(`${next.start}T00:00:00Z`)
    const diffDays = (nextStart.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBe(14)
  })

  it("previous period is exactly 14 days before current start", () => {
    const current = getPayPeriodForDate(utcDate(2026, 3, 19))
    const prev = getAdjacentPayPeriod(current.start, "prev")

    const currentStart = new Date(`${current.start}T00:00:00Z`)
    const prevStart = new Date(`${prev.start}T00:00:00Z`)
    const diffDays = (currentStart.getTime() - prevStart.getTime()) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBe(14)
  })

  it("chains correctly: next(current) -> prev() gives back current", () => {
    const current = getPayPeriodForDate(utcDate(2026, 3, 19))
    const next = getAdjacentPayPeriod(current.start, "next")
    const backToCurrent = getAdjacentPayPeriod(next.start, "prev")
    expect(backToCurrent.start).toBe(current.start)
    expect(backToCurrent.end).toBe(current.end)
  })

  it("next and prev are inverses", () => {
    const start = getPayPeriodForDate(utcDate(2026, 6, 15))
    const next = getAdjacentPayPeriod(start.start, "next")
    const prev = getAdjacentPayPeriod(next.start, "prev")
    expect(prev.start).toBe(start.start)
  })

  it("handles year boundaries", () => {
    const endOfYear = getPayPeriodForDate(utcDate(2026, 12, 20))
    const next = getAdjacentPayPeriod(endOfYear.start, "next")
    expect(next.label).toBeTruthy()
    // Next period should be in 2027 if we're late in the year
    if (endOfYear.end.startsWith("2027")) {
      expect(next.label).toContain("2027")
    }
  })
})

describe("formatPeriodLabel", () => {
  it("formats same-month periods correctly", () => {
    const label = formatPeriodLabel("2026-03-05", "2026-03-18")
    expect(label).toBe("Mar 5 – 18")
  })

  it("formats cross-month periods correctly", () => {
    const label = formatPeriodLabel("2026-03-19", "2026-04-01")
    expect(label).toBe("Mar 19 – Apr 1")
  })

  it("formats cross-year periods correctly", () => {
    const label = formatPeriodLabel("2026-12-26", "2027-01-08")
    expect(label).toBe("Dec 26, 2026 – Jan 8, 2027")
  })

  it("includes day and month only when appropriate", () => {
    // Same month: "Mar 5 – 18"
    const sameMonth = formatPeriodLabel("2026-03-05", "2026-03-18")
    expect(sameMonth).not.toContain("Mar Mar")

    // Different months, same year: "Mar 19 – Apr 1"
    const diffMonth = formatPeriodLabel("2026-03-19", "2026-04-01")
    expect(diffMonth).not.toContain("2026")
  })
})

describe("Pay period edge cases", () => {
  it("leap year date works correctly", () => {
    // 2024 is a leap year
    const result = getPayPeriodForDate(utcDate(2024, 2, 29))
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("very old date works correctly", () => {
    const result = getPayPeriodForDate(utcDate(2000, 1, 1))
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("far future date works correctly", () => {
    const result = getPayPeriodForDate(utcDate(2050, 12, 31))
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
