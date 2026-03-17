"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex gap-3">
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
          theme === "light"
            ? "border-primary bg-primary/10 text-primary"
            : "border-border hover:bg-muted"
        )}
      >
        <Sun className="size-4" /> Light
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors",
          theme === "dark"
            ? "border-primary bg-primary/10 text-primary"
            : "border-border hover:bg-muted"
        )}
      >
        <Moon className="size-4" /> Dark
      </button>
    </div>
  )
}
