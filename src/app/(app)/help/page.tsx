"use client"

import { useState, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { APP_NAME, APP_VERSION, APP_CREATOR, RELEASE_NOTES } from "@/lib/app-config"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { toast } from "sonner"
import { FileText, Bug, HelpCircle } from "lucide-react"
import { DevPanel, useDevMode } from "./dev-panel"

// ── FAQ ───────────────────────────────────────────────────────────
// Replace with app-specific questions before shipping.
const FAQ_ITEMS = [
  {
    q: "How do I get started?",
    a: "Sign in with the credentials from your invitation email. You'll be taken to the dashboard where you can explore the app.",
  },
  {
    q: "How do I install this app on my phone?",
    a: "On iPhone: open in Safari, tap the share icon, then \"Add to Home Screen.\" On Android: tap the browser menu (three dots), then \"Install app.\"",
  },
  {
    q: "Who do I contact for support?",
    a: "Use the \"Report a Problem\" form at the bottom of this page.",
  },
]

// ── Dev domain for dev panel access ──────────────────────────────
// Users on this domain or with admin role can access the dev panel.
const DEV_DOMAIN = "sequentialanalytics.com"

export default function HelpPage() {
  const { user, profile, realRole } = useUser()
  const supabase = createClient()
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const { active: devMode, toggle: toggleDevMode } = useDevMode()
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null)

  const canAccessDevMode =
    realRole === "admin" || (user?.email?.endsWith(`@${DEV_DOMAIN}`) ?? false)

  const handleVersionTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!canAccessDevMode) return
    e.preventDefault()
    tapCountRef.current += 1
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      if (!devMode) { toggleDevMode(true); toast.success("Developer mode activated") }
      return
    }
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 1000)
  }, [devMode, toggleDevMode, canAccessDevMode])

  async function handleSubmit() {
    if (!category || !description.trim() || !profile) return
    setSubmitting(true)

    const { error } = await supabase.from("feedback").insert({
      user_id: profile.id,
      category,
      description: description.trim(),
    })

    if (error) {
      toast.error("Failed to submit feedback")
    } else {
      toast.success("Feedback submitted — thank you!")
      // Fire-and-forget notification (optional edge function)
      try {
        supabase.functions.invoke("notify-feedback", {
          body: { user_id: profile.id, category, description: description.trim() },
        }).catch(() => {})
      } catch { /* ignore if not deployed */ }
      setCategory("")
      setDescription("")
    }
    setSubmitting(false)
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Help &amp; About</h1>

      {/* Branding / version */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg">{APP_NAME}</CardTitle>
            <CardDescription>{APP_CREATOR}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Badge
            variant="secondary"
            className="text-sm cursor-default select-none touch-manipulation"
            onClick={handleVersionTap}
            onTouchEnd={handleVersionTap}
          >
            {APP_VERSION}
          </Badge>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <HelpCircle className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Release notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Release Notes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {RELEASE_NOTES.map((release, i) => (
              <AccordionItem key={release.version} value={`release-${i}`}>
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{release.version}</Badge>
                    <span className="text-muted-foreground">{release.date}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {release.changes.map((change, j) => <li key={j}>{change}</li>)}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Feedback / bug report */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Bug className="size-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Report a Problem</CardTitle>
              <CardDescription>Found a bug or have a suggestion? Let us know.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug Report</SelectItem>
              <SelectItem value="feature_request">Feature Request</SelectItem>
              <SelectItem value="question">Question</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Describe the issue or suggestion..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <Button onClick={handleSubmit} disabled={!category || !description.trim() || submitting}>
            {submitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </CardContent>
      </Card>

      {devMode && canAccessDevMode && (
        <DevPanel onExit={() => toggleDevMode(false)} />
      )}
    </div>
  )
}
