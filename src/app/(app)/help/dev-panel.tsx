"use client"

/**
 * DevPanel — hidden developer tools panel.
 *
 * Activation: triple-tap the version badge on the Help page (admin/dev domain only).
 * Gate: only renders when NEXT_PUBLIC_DEV_PANEL_ENABLED=true.
 *
 * Features:
 * - Role impersonation (localStorage + cookie so server components see it)
 * - Table row counts (configurable list)
 * - Cache/storage clear
 * - Feature flags (localStorage, per-flag toggles)
 * - Test data generate/clear via API
 */

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Terminal,
  Database,
  Users,
  Trash2,
  Flag,
  XCircle,
  RefreshCw,
  Loader2,
  FlaskConical,
} from "lucide-react"

export const DEV_MODE_KEY = "app-dev-mode"
export const ROLE_OVERRIDE_KEY = "app-role-override"
const FLAGS_KEY = "app-feature-flags"

interface TableInfo {
  name: string
  count: number
}

// ── Config: update these for each project ────────────────────────
const ROLES = ["admin", "manager", "member"] as const

// Tables to show counts for in the data viewer
const WATCHED_TABLES = ["profiles", "feedback"] as const

// Feature flags — add new ones here
const DEFAULT_FLAGS: Record<string, boolean> = {
  // "new-feature": false,
}

// ── Hooks ────────────────────────────────────────────────────────

export function useDevMode() {
  const [active, setActive] = useState(false)
  useEffect(() => { setActive(localStorage.getItem(DEV_MODE_KEY) === "true") }, [])
  const toggle = useCallback((on: boolean) => {
    localStorage.setItem(DEV_MODE_KEY, String(on))
    setActive(on)
  }, [])
  return { active, toggle }
}

export function getRoleOverride(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ROLE_OVERRIDE_KEY)
}

export function isDevPanelEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_PANEL_ENABLED === "true"
}

// ── Component ────────────────────────────────────────────────────

export function DevPanel({ onExit }: { onExit: () => void }) {
  if (!isDevPanelEnabled()) return null

  const supabase = createClient()
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [roleOverride, setRoleOverride] = useState("none")
  const [savedRole, setSavedRole] = useState("none")
  const [flags, setFlags] = useState<Record<string, boolean>>(DEFAULT_FLAGS)
  const [generatingData, setGeneratingData] = useState(false)
  const [clearingData, setClearingData] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(ROLE_OVERRIDE_KEY)
    if (saved) { setSavedRole(saved); setRoleOverride(saved) }
    const savedFlags = localStorage.getItem(FLAGS_KEY)
    if (savedFlags) {
      try { setFlags({ ...DEFAULT_FLAGS, ...JSON.parse(savedFlags) }) } catch { /* ignore */ }
    }
  }, [])

  async function loadTables() {
    setLoadingTables(true)
    const results: TableInfo[] = []
    for (const name of WATCHED_TABLES) {
      const { count } = await supabase.from(name).select("*", { count: "exact", head: true })
      results.push({ name, count: count ?? 0 })
    }
    setTables(results)
    setLoadingTables(false)
  }

  function applyRole() {
    if (roleOverride === "none") {
      localStorage.removeItem(ROLE_OVERRIDE_KEY)
      document.cookie = `${ROLE_OVERRIDE_KEY}=; path=/; max-age=0`
    } else {
      localStorage.setItem(ROLE_OVERRIDE_KEY, roleOverride)
      document.cookie = `${ROLE_OVERRIDE_KEY}=${roleOverride}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
    }
    toast.success(roleOverride === "none" ? "Role override removed — reloading..." : `Now viewing as "${roleOverride}" — reloading...`)
    setTimeout(() => window.location.reload(), 400)
  }

  function resetRole() {
    setRoleOverride("none")
    localStorage.removeItem(ROLE_OVERRIDE_KEY)
    document.cookie = `${ROLE_OVERRIDE_KEY}=; path=/; max-age=0`
    toast.success("Role override cleared — reloading...")
    setTimeout(() => window.location.reload(), 400)
  }

  async function clearAllStorage() {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(DEV_MODE_KEY, "true")
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) await reg.unregister()
    }
    toast.success("All storage & service workers cleared")
  }

  function toggleFlag(key: string) {
    const updated = { ...flags, [key]: !flags[key] }
    setFlags(updated)
    localStorage.setItem(FLAGS_KEY, JSON.stringify(updated))
    toast.success(`Flag "${key}" ${updated[key] ? "enabled" : "disabled"}`)
  }

  async function generateTestData() {
    setGeneratingData(true)
    try {
      const res = await fetch("/api/admin/test-data", { method: "POST" })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed")
      toast.success("Test data generated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate test data")
    }
    setGeneratingData(false)
  }

  async function clearTestData() {
    setClearingData(true)
    try {
      const res = await fetch("/api/admin/test-data", { method: "DELETE" })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed")
      toast.success("Test data cleared")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear test data")
    }
    setClearingData(false)
  }

  function handleExit() {
    localStorage.removeItem(DEV_MODE_KEY)
    localStorage.removeItem(ROLE_OVERRIDE_KEY)
    localStorage.removeItem(FLAGS_KEY)
    document.cookie = `${ROLE_OVERRIDE_KEY}=; path=/; max-age=0`
    onExit()
    toast.success("Developer mode deactivated")
  }

  const roleHasChanged = roleOverride !== savedRole

  return (
    <Card className="border-dashed border-2 border-destructive/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <Terminal className="size-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Developer Tools</CardTitle>
              <CardDescription>Triple-tap version badge to toggle</CardDescription>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleExit} className="gap-1.5">
            <XCircle className="size-3.5" />
            Exit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Table counts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Supabase Tables</span>
            </div>
            <Button variant="outline" size="sm" onClick={loadTables} disabled={loadingTables} className="gap-1.5">
              {loadingTables ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {tables.length > 0 ? "Refresh" : "Load"}
            </Button>
          </div>
          {tables.length > 0 && (
            <div className="rounded-md border">
              {tables.map((t) => (
                <div key={t.name} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 text-sm">
                  <code className="text-xs">{t.name}</code>
                  <Badge variant="secondary" className="text-xs font-mono">{t.count.toLocaleString()}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Role impersonation */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Role Impersonation</span>
          </div>
          <Select value={roleOverride} onValueChange={setRoleOverride}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Override (real role)</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyRole} disabled={!roleHasChanged} className="gap-1.5">
              <RefreshCw className="size-3.5" />Apply &amp; Reload
            </Button>
            {savedRole !== "none" && (
              <Button variant="outline" size="sm" onClick={resetRole} className="gap-1.5">
                <XCircle className="size-3.5" />Reset
              </Button>
            )}
          </div>
          {savedRole !== "none" && (
            <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
              Active override: {savedRole}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Storage */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trash2 className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Cache &amp; Storage</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearAllStorage}>Clear All Storage</Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Hard Reload</Button>
          </div>
        </div>

        <Separator />

        {/* Test data */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Test Data</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={generateTestData} disabled={generatingData || clearingData} className="gap-1.5">
              {generatingData ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />}
              {generatingData ? "Generating..." : "Generate Dataset"}
            </Button>
            <Button variant="outline" size="sm" onClick={clearTestData} disabled={clearingData || generatingData} className="gap-1.5 text-destructive hover:text-destructive">
              {clearingData ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {clearingData ? "Clearing..." : "Clear Test Data"}
            </Button>
          </div>
        </div>

        {Object.keys(DEFAULT_FLAGS).length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flag className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Feature Flags</span>
              </div>
              {Object.entries(flags).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={`flag-${key}`} className="text-sm font-mono">{key}</Label>
                  <Switch id={`flag-${key}`} checked={enabled} onCheckedChange={() => toggleFlag(key)} />
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
