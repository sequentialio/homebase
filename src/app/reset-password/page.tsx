"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [userName, setUserName] = useState("")
  const router = useRouter()
  const supabase = createClient()

  // Detect first-time invited users to show a welcome message
  useEffect(() => {
    async function checkNewUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.invited_at) {
        const signInCount = user.app_metadata?.sign_in_count ?? 0
        if (signInCount <= 1) {
          setIsNewUser(true)
          setUserName(user.user_metadata?.full_name || "")
        }
      }
    }
    checkNewUser()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  const firstName = userName ? userName.split(" ")[0] : ""

  return (
    <div className="dark flex min-h-screen items-center justify-center px-4 bg-black">
      <Card className="w-full max-w-sm shadow-lg border border-white/10">
        <CardHeader className="text-center items-center gap-4 pb-6">
          <Image
            src="/logos/mita_full_cropped.png"
            alt="MITA"
            width={280}
            height={96}
            className="object-contain h-14 w-auto mx-auto block"
          />
          <CardTitle className="text-2xl font-bold">
            {isNewUser ? `Welcome${firstName ? `, ${firstName}` : ""}!` : "Set New Password"}
          </CardTitle>
          <CardDescription>
            {isNewUser
              ? "Create a password to finish setting up your account."
              : "Enter your new password below"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Setting up..."
                : isNewUser
                  ? "Create Password & Get Started"
                  : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
