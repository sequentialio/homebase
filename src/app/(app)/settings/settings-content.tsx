"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PlaidConnectButton } from "@/components/plaid/plaid-connect-button"
import type { Tables } from "@/types/database"


type Profile = Tables<"profiles">

interface PlaidItem {
  id: string
  institution_name: string | null
  last_synced_at: string | null
  created_at: string
}

interface AsanaConnection {
  workspace_name: string | null
  workspace_id: string | null
  created_at: string
}

interface GoogleConnection {
  email: string | null
  updated_at: string
}

interface SettingsContentProps {
  userId: string
  userEmail: string
  profile: Profile | null
  asanaConnection: AsanaConnection | null
  googleConnection: GoogleConnection | null
  plaidItems: PlaidItem[]
}

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
})
type ProfileFormValues = z.infer<typeof profileSchema>

export function SettingsContent({
  userId,
  userEmail,
  profile,
  asanaConnection,
  googleConnection,
  plaidItems: initialPlaidItems,
}: SettingsContentProps) {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()

  const [asanaConn, setAsanaConn] = useState<AsanaConnection | null>(asanaConnection)
  const [googleConn, setGoogleConn] = useState<GoogleConnection | null>(googleConnection)
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>(initialPlaidItems)
  const [disconnectingAsana, setDisconnectingAsana] = useState(false)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)
  const [syncingPlaid, setSyncingPlaid] = useState(false)
  const [disconnectingPlaid, setDisconnectingPlaid] = useState<string | null>(null)

  // Show toast based on OAuth redirect params
  useEffect(() => {
    const oauth = searchParams.get("oauth")
    const status = searchParams.get("status")
    const reason = searchParams.get("reason")

    if (!oauth || !status) return

    const label = oauth === "asana" ? "Asana" : "Google Calendar"

    if (status === "connected") {
      toast.success(`${label} connected successfully`)
      if (oauth === "asana") {
        fetch("/api/asana/status")
          .then((r) => r.json())
          .then((d) => {
            if (d.connected) {
              setAsanaConn({
                workspace_name: d.workspace_name,
                workspace_id: d.workspace_id,
                connected_at: d.connected_at,
              } as unknown as AsanaConnection)
            }
          })
          .catch(() => {})
      } else if (oauth === "google") {
        fetch("/api/google/status")
          .then((r) => r.json())
          .then((d) => {
            if (d.connected) {
              setGoogleConn({ email: d.email, updated_at: d.connected_at })
            }
          })
          .catch(() => {})
      }
    } else if (status === "error") {
      const KNOWN_REASONS: Record<string, string> = {
        token_exchange: "Token exchange failed",
        db_error: "Database error",
        state_mismatch: "Security check failed",
        missing_params: "Missing parameters",
        no_refresh_token: "No refresh token returned",
        unknown: "Unknown error",
      }
      const displayReason = reason ? KNOWN_REASONS[reason] ?? "Connection failed" : null
      toast.error(`${label} connection failed${displayReason ? `: ${displayReason}` : ""}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: profile?.full_name ?? "" },
  })

  async function onProfileSave(values: ProfileFormValues) {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: values.full_name, updated_at: new Date().toISOString() })
      .eq("id", userId)

    if (error) { toast.error("Failed to save profile"); return }
    toast.success("Profile saved")
  }

  async function handleAsanaDisconnect() {
    setDisconnectingAsana(true)
    const res = await fetch("/api/asana/disconnect", { method: "POST" })
    if (res.ok) {
      setAsanaConn(null)
      toast.success("Asana disconnected")
    } else {
      toast.error("Failed to disconnect Asana")
    }
    setDisconnectingAsana(false)
  }

  async function handleGoogleDisconnect() {
    setDisconnectingGoogle(true)
    const res = await fetch("/api/google/disconnect", { method: "POST" })
    if (res.ok) {
      setGoogleConn(null)
      toast.success("Google Calendar disconnected")
    } else {
      toast.error("Failed to disconnect Google Calendar")
    }
    setDisconnectingGoogle(false)
  }

  async function handlePlaidSync() {
    setSyncingPlaid(true)
    const res = await fetch("/api/plaid/sync", { method: "POST" })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Synced ${data.synced} bank${data.synced !== 1 ? "s" : ""} — ${data.added} new transaction${data.added !== 1 ? "s" : ""}`)
      // Refresh items to show updated last_synced_at
      const { data: items } = await (supabase as any).from("plaid_items").select("id, institution_name, last_synced_at, created_at").order("created_at")
      if (items) setPlaidItems(items as PlaidItem[])
    } else {
      toast.error("Sync failed")
    }
    setSyncingPlaid(false)
  }

  async function handlePlaidDisconnect(itemId: string) {
    setDisconnectingPlaid(itemId)
    const res = await fetch("/api/plaid/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    })
    if (res.ok) {
      setPlaidItems((prev) => prev.filter((i) => i.id !== itemId))
      toast.success("Bank disconnected")
    } else {
      toast.error("Failed to disconnect bank")
    }
    setDisconnectingPlaid(null)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* ── Profile ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Your name and account details.</p>
        </div>

        <form onSubmit={form.handleSubmit(onProfileSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={userEmail} disabled className="text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input placeholder="Your name" {...form.register("full_name")} />
            {form.formState.errors.full_name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.full_name.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting} size="sm">
            {form.formState.isSubmitting ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </section>

      <div className="border-t" />

      {/* ── Integrations ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">Connect external services.</p>
        </div>

        {/* Asana */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Asana</p>
              <p className="text-xs text-muted-foreground">Sync tasks to the calendar</p>
            </div>
            {asanaConn ? (
              <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-400/50 gap-1">
                <CheckCircle2 className="size-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                <XCircle className="size-3" /> Not connected
              </Badge>
            )}
          </div>

          {asanaConn && (
            <p className="text-xs text-muted-foreground">
              Workspace: <span className="font-medium">{asanaConn.workspace_name ?? "Unknown"}</span>
            </p>
          )}

          <div className="flex gap-2">
            {asanaConn ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAsanaDisconnect}
                disabled={disconnectingAsana}
                className="text-destructive hover:text-destructive"
              >
                {disconnectingAsana ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
                Disconnect
              </Button>
            ) : (
              <Button size="sm" asChild>
                <a href="/api/asana/connect">
                  <ExternalLink className="size-3.5 mr-1.5" /> Connect Asana
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Connected Banks (Plaid) */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Connected Banks</p>
              <p className="text-xs text-muted-foreground">Auto-sync transactions daily via Plaid</p>
            </div>
            {plaidItems.length > 0 && (
              <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-400/50 gap-1">
                <CheckCircle2 className="size-3" /> {plaidItems.length} connected
              </Badge>
            )}
          </div>

          {plaidItems.length > 0 && (
            <div className="space-y-2">
              {plaidItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{item.institution_name ?? "Unknown Bank"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.last_synced_at
                        ? `Last synced ${new Date(item.last_synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                        : "Never synced"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!size-7 !min-h-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handlePlaidDisconnect(item.id)}
                    disabled={disconnectingPlaid === item.id}
                    title="Disconnect"
                  >
                    {disconnectingPlaid === item.id
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <PlaidConnectButton onSuccess={async () => {
              const { data } = await (supabase as any).from("plaid_items").select("id, institution_name, last_synced_at, created_at").order("created_at")
              if (data) setPlaidItems(data as PlaidItem[])
            }} />
            {plaidItems.length > 0 && (
              <Button variant="outline" size="sm" onClick={handlePlaidSync} disabled={syncingPlaid} className="gap-2">
                {syncingPlaid ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Sync Now
              </Button>
            )}
          </div>
        </div>

        {/* Google Calendar */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Sync Google Calendar events</p>
            </div>
            {googleConn ? (
              <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-400/50 gap-1">
                <CheckCircle2 className="size-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                <XCircle className="size-3" /> Not connected
              </Badge>
            )}
          </div>

          {googleConn?.email && (
            <p className="text-xs text-muted-foreground">
              Account: <span className="font-medium">{googleConn.email}</span>
            </p>
          )}

          <div className="flex gap-2">
            {googleConn ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoogleDisconnect}
                disabled={disconnectingGoogle}
                className="text-destructive hover:text-destructive"
              >
                {disconnectingGoogle ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
                Disconnect
              </Button>
            ) : (
              <Button size="sm" asChild>
                <a href="/api/google/connect">
                  <ExternalLink className="size-3.5 mr-1.5" /> Connect Google Calendar
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
