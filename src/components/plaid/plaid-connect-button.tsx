"use client"

import { useState, useEffect, useCallback } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Landmark, Loader2 } from "lucide-react"

interface PlaidConnectButtonProps {
  onSuccess?: () => void
}

async function fetchLinkToken(): Promise<string | null> {
  const res = await fetch("/api/plaid/create-link-token", { method: "POST" })
  const data = await res.json()
  if (data.link_token) return data.link_token
  console.error("[PlaidConnectButton] token fetch failed:", data)
  return null
}

export function PlaidConnectButton({ onSuccess }: PlaidConnectButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)
  const [tokenError, setTokenError] = useState(false)

  // Fetch link token eagerly on mount so Plaid SDK is ready before the user clicks
  useEffect(() => {
    let cancelled = false
    fetchLinkToken()
      .then((token) => {
        if (!cancelled && token) setLinkToken(token)
        if (!cancelled && !token) setTokenError(true)
      })
      .catch(() => { if (!cancelled) setTokenError(true) })
    return () => { cancelled = true }
  }, [])

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
    fetchLinkToken()
      .then((token) => { if (token) setLinkToken(token) })
      .catch(() => {})
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  })

  // open() is called directly from the click handler — preserves user gesture
  if (tokenError) {
    return (
      <Button
        onClick={() => {
          setTokenError(false)
          fetchLinkToken()
            .then((token) => { if (token) setLinkToken(token); else setTokenError(true) })
            .catch(() => setTokenError(true))
        }}
        variant="outline"
        className="gap-2"
      >
        <Landmark className="size-4" />
        Retry Bank Connection
      </Button>
    )
  }

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || exchanging}
      variant="outline"
      className="gap-2"
    >
      {exchanging ? (
        <Loader2 className="size-4 animate-spin" />
      ) : !ready ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Landmark className="size-4" />
      )}
      {exchanging ? "Connecting..." : !ready ? "Loading..." : "Connect Bank Account"}
    </Button>
  )
}
