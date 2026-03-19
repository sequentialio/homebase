"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { usePlaidLink } from "react-plaid-link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Landmark, Loader2 } from "lucide-react"

interface PlaidConnectButtonProps {
  onSuccess?: () => void
}

export function PlaidConnectButton({ onSuccess }: PlaidConnectButtonProps) {
  const supabase = useMemo(() => createClient(), [])
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)

  // Fetch link token eagerly on mount so Plaid SDK is ready before the user clicks
  useEffect(() => {
    let cancelled = false
    async function fetchToken() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const res = await fetch("/api/plaid/create-link-token", { method: "POST" })
        const data = await res.json()
        if (!cancelled && data.link_token) setLinkToken(data.link_token)
      } catch {
        // Silent — button will stay disabled until token is ready
      }
    }
    fetchToken()
    return () => { cancelled = true }
  }, [supabase])

  const handlePlaidSuccess = useCallback(async (
    public_token: string,
    metadata: { institution: { name: string; institution_id: string } | null },
  ) => {
    setExchanging(true)
    try {
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token, institution: metadata.institution }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(
          `Connected ${data.institution_name} — ${data.accounts_connected} account${data.accounts_connected !== 1 ? "s" : ""}`
        )
        onSuccess?.()
      } else {
        toast.error("Failed to connect bank")
      }
    } catch {
      toast.error("Failed to connect bank")
    } finally {
      setExchanging(false)
      setLinkToken(null)
    }
  }, [onSuccess])

  const handlePlaidExit = useCallback(() => {
    // User closed Plaid Link — re-fetch a fresh token for next attempt
    setLinkToken(null)
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => { if (data.link_token) setLinkToken(data.link_token) })
      .catch(() => {})
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  })

  // open() is called directly from the click handler — preserves user gesture
  return (
    <Button
      onClick={() => open()}
      disabled={!ready || exchanging}
      variant="outline"
      className="gap-2"
    >
      {exchanging ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Landmark className="size-4" />
      )}
      {exchanging ? "Connecting..." : "Connect Bank Account"}
    </Button>
  )
}
