"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { Tables } from "@/types/database"

type Profile = Tables<"profiles">

/** Dispatch this event from anywhere to make useUser() re-fetch the profile */
export const PROFILE_UPDATED_EVENT = "profile-updated"

/** localStorage key used by dev-panel role impersonation */
const ROLE_OVERRIDE_KEY = "preconfig-role-override"

/** Read the active role override (if any). Returns null when no override or when disabled in production. */
export function getRoleOverride(): string | null {
  if (typeof window === "undefined") return null
  if (process.env.NEXT_PUBLIC_DEV_PANEL_ENABLED !== "true") return null
  const v = localStorage.getItem(ROLE_OVERRIDE_KEY)
  return v && v !== "none" ? v : null
}

export function useUser(initialProfile: Profile | null = null) {
  const [user, setUser] = useState<User | null>(null)
  const [rawProfile, setRawProfile] = useState<Profile | null>(initialProfile)
  const [loading, setLoading] = useState(initialProfile === null)
  const supabase = useMemo(() => createClient(), [])

  // Read role override once on mount (it persists until cleared)
  const [roleOverride, setRoleOverride] = useState<string | null>(null)
  useEffect(() => {
    setRoleOverride(getRoleOverride())
  }, [])

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()
      if (data) setRawProfile(data)
    },
    [supabase]
  )

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        await fetchProfile(user.id)
      }

      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setRawProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  // Re-fetch profile when any component signals an update
  useEffect(() => {
    function handleProfileUpdate() {
      if (user) fetchProfile(user.id)
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdate)
  }, [user, fetchProfile])

  // Apply role override on top of real profile (client-side only)
  const profile = useMemo<Profile | null>(() => {
    if (!rawProfile) return null
    if (!roleOverride) return rawProfile
    return { ...rawProfile, role: roleOverride as Profile["role"] }
  }, [rawProfile, roleOverride])

  // Expose the real (un-overridden) role so dev panel access checks use it
  const realRole = rawProfile?.role ?? null

  return { user, profile, loading, roleOverride, realRole }
}
