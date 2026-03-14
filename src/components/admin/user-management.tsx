"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Copy, Mail, UserPlus, Pencil } from "lucide-react"
import type { Tables } from "@/types/database"

type Profile = Tables<"profiles">

// ── Config: adapt these to your role system ───────────────────────
const ROLES = ["admin", "manager", "member"] as const
type Role = typeof ROLES[number]

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  member: "Member",
}

// ── Email template ───────────────────────────────────────────────
// Stored in localStorage so admins can customise once and reuse.
const TEMPLATE_STORAGE_KEY = "invite-email-template"

const DEFAULT_EMAIL_TEMPLATE = `Hi {{name}},

You've been invited to join {{app_name}}.

Click the link below to set up your account:
{{invite_link}}

This link expires in 24 hours.

– The {{app_name}} Team`

interface UserManagementProps {
  currentUserId: string
}

export function UserManagement({ currentUserId }: UserManagementProps) {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Role>("member")
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_EMAIL_TEMPLATE)
  const [showTemplate, setShowTemplate] = useState(false)

  // Edit state
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editRole, setEditRole] = useState<Role>("member")
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY)
    if (saved) setEmailTemplate(saved)
    loadUsers()
  }, [])

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name")
    setUsers(data ?? [])
    setLoading(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteLink(null)

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })

    const data = await res.json()

    if (!res.ok) {
      toast.error(data.error ?? "Failed to generate invite link")
    } else {
      setInviteLink(data.invite_link)
      toast.success("Invite link generated")
    }

    setInviting(false)
  }

  function buildEmailBody(link: string): string {
    const appName = document.title || "the app"
    return emailTemplate
      .replace(/{{name}}/g, inviteEmail.split("@")[0])
      .replace(/{{app_name}}/g, appName)
      .replace(/{{invite_link}}/g, link)
  }

  function copyLink() {
    if (!inviteLink) return
    const fallback = () => {
      try {
        const ta = document.createElement("textarea")
        ta.value = inviteLink
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        toast.success("Link copied")
      } catch {
        toast.error("Could not copy — please copy manually")
      }
    }
    try {
      navigator.clipboard.writeText(inviteLink).then(
        () => toast.success("Link copied"),
        fallback
      )
    } catch {
      fallback()
    }
  }

  function copyEmail() {
    if (!inviteLink) return
    const body = buildEmailBody(inviteLink)
    const fallback = () => {
      try {
        const ta = document.createElement("textarea")
        ta.value = body
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        toast.success("Email body copied")
      } catch {
        toast.error("Could not copy — please copy manually")
      }
    }
    try {
      navigator.clipboard.writeText(body).then(
        () => toast.success("Email body copied"),
        fallback
      )
    } catch {
      fallback()
    }
  }

  function saveTemplate() {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, emailTemplate)
    toast.success("Template saved")
    setShowTemplate(false)
  }

  function openEdit(user: Profile) {
    setEditUser(user)
    setEditRole((user.role as Role) ?? "member")
    setEditActive(user.is_active ?? true)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)

    const res = await fetch(`/api/admin/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: editUser.id, role: editRole, is_active: editActive }),
    })

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? "Failed to save")
    } else {
      toast.success("User updated")
      setEditUser(null)
      loadUsers()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* ── Invite New User ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <UserPlus className="size-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>Invite User</CardTitle>
              <CardDescription>Generate a one-time invite link</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting ? "Generating..." : "Generate Invite Link"}
            </Button>
          </form>

          {inviteLink && (
            <div className="space-y-3 pt-2">
              <Separator />
              <p className="text-sm font-medium">Invite link ready</p>
              <div className="flex items-center gap-2">
                <Input value={inviteLink} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0 gap-1.5">
                  <Copy className="size-3.5" />
                  Copy Link
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={copyEmail} className="gap-1.5">
                  <Mail className="size-3.5" />
                  Copy Email Body
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTemplate(!showTemplate)}
                  className="text-muted-foreground"
                >
                  {showTemplate ? "Hide" : "Edit"} Email Template
                </Button>
              </div>
              {showTemplate && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Use <code className="bg-muted px-1 rounded text-[11px]">{"{{name}}"}</code>,{" "}
                    <code className="bg-muted px-1 rounded text-[11px]">{"{{app_name}}"}</code>,{" "}
                    <code className="bg-muted px-1 rounded text-[11px]">{"{{invite_link}}"}</code>
                  </p>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-[180px] resize-y"
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveTemplate}>Save Template</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEmailTemplate(DEFAULT_EMAIL_TEMPLATE)}>
                      Reset to Default
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── User List ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{users.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={user.is_active ? "outline" : "secondary"} className="text-xs capitalize">
                      {user.role?.replace("_", " ")}
                    </Badge>
                    {!user.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                    {user.id !== currentUserId && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ──────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Active</Label>
              <Switch
                id="edit-active"
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
