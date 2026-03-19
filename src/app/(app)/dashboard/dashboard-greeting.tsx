"use client"

export function DashboardGreeting({ name }: { name: string }) {
  const now = new Date()

  const greeting = (() => {
    const h = now.getHours()
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  })()

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <div>
      <h1 className="text-2xl font-bold">{greeting}, {name}</h1>
      <p className="text-sm text-muted-foreground">{dateStr}</p>
    </div>
  )
}
