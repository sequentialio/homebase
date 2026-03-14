"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { APP_NAME } from "@/lib/app-config"

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function verifyInvite() {
      const token = searchParams.get("token")
      const type = searchParams.get("type")

      if (!token || type !== "invite") {
        setError("Invalid or missing invite link.")
        return
      }

      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "invite",
      })

      if (verifyError) {
        setError(verifyError.message)
        return
      }

      // Session established — redirect to set password
      router.replace("/reset-password")
    }

    verifyInvite()
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {error ? "Invite Error" : "Setting up your account..."}
          </CardTitle>
          <CardDescription>
            {error || `Welcome to ${APP_NAME}. Please wait while we verify your invitation.`}
          </CardDescription>
        </CardHeader>
        {!error && (
          <CardContent className="flex justify-center pb-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Setting up your account...</CardTitle>
              <CardDescription>Please wait while we verify your invitation.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  )
}
