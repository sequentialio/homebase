import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { SessionTimeout } from "@/components/session-timeout"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <Toaster />
      <SessionTimeout />
    </AppShell>
  )
}
