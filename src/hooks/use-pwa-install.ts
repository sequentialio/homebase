"use client"

import { useState, useEffect } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    function handler(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true)
      setPromptEvent(null)
    })

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === "accepted") {
      setIsInstalled(true)
      setPromptEvent(null)
    }
  }

  return {
    canInstall: !!promptEvent && !isInstalled,
    isInstalled,
    install,
  }
}
