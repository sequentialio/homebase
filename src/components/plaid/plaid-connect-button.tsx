"use client"

import { useState, useCallback } from "react"
import { usePlaidLink } from "react-plaid-link"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Landmark, Loader2 } from "lucide-react"

interface PlaidConnectButtonProps {
  onSuccess?: () => void
}

export function PlaidConnectButton({ onSuccess }: PlaidConnectButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchLinkToken = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" })
      const data = await res.json()
      if (data.link_token) setLinkToken(data.link_token)
      else toast.error("Failed to initialize bank connection")
    } catch {
      toast.error("Failed to initialize bank connection")
    } finally {
      setLoading(false)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setLoading(true)
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token,
            institution: metadata.institution,
          }),
        })
        const data = await res.json()
        if (data.success) {
          toast.success(`Connected ${data.institution_name} — ${data.accounts_connected} account${data.accounts_connected !== 1 ? "s" : ""}`)
          onSuccess?.()
        } else {
          toast.error("Failed to connect bank")
        }
      } catch {
        toast.error("Failed to connect bank")
      } finally {
        setLoading(false)
        setLinkToken(null)
      }
    },
    onExit: () => setLinkToken(null),
  })

  const handleClick = useCallback(async () => {
    if (linkToken && ready) {
      open()
    } else {
      await fetchLinkToken()
    }
  }, [linkToken, ready, open, fetchLinkToken])

  // Auto-open once link token is ready
  const handleReady = useCallback(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  // Trigger open when ready changes to true after token fetch
  if (linkToken && ready) {
    open()
  }

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline" className="gap-2">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
      Connect Bank Account
    </Button>
  )
}
