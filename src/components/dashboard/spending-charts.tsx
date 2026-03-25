"use client"

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"

interface Transaction {
  amount: number
  type: "income" | "expense"
  category?: string
  date: string
  description: string
}

interface SpendingChartsProps {
  transactions: Transaction[]
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#ef4444",
  Transportation: "#f97316",
  Shopping: "#eab308",
  Entertainment: "#06b6d4",
  Utilities: "#3b82f6",
  Healthcare: "#8b5cf6",
  Subscriptions: "#ec4899",
  Personal: "#14b8a6",
  other: "#6b7280",
}

export function SpendingCharts({ transactions }: SpendingChartsProps) {
  // Breakdown by category
  const categoryData = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      const category = t.category || "Other"
      const existing = acc.find((d) => d.name === category)
      if (existing) {
        existing.value += Number(t.amount)
      } else {
        acc.push({ name: category, value: Number(t.amount) })
      }
      return acc
    }, [] as Array<{ name: string; value: number }>)
    .sort((a, b) => b.value - a.value)

  // Daily spending trend
  const dailyData = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => {
      const date = t.date
      const existing = acc.find((d) => d.date === date)
      if (existing) {
        existing.amount += Number(t.amount)
      } else {
        acc.push({ date, amount: Number(t.amount) })
      }
      return acc
    }, [] as Array<{ date: string; amount: number }>)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (categoryData.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No expense data to display
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category breakdown */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold mb-4">Spending by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryData.map((entry) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS.other}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Daily trend */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold mb-4">Daily Spending Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.5)"
              style={{ fontSize: "12px" }}
              tickFormatter={(date) => {
                const d = new Date(date)
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }}
            />
            <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
            <Tooltip
              formatter={(value) => `$${Number(value).toFixed(0)}`}
              labelFormatter={(date) =>
                new Date(date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
              contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.2)" }}
            />
            <Bar dataKey="amount" fill="#d2ff46" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
