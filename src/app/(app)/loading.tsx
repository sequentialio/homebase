import { Loader2 } from "lucide-react"

/**
 * Next.js App Router loading UI for the (app) route group.
 * Shown automatically while a page's async Server Component resolves.
 * Replace the icon/animation to match your app's brand.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="size-10 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  )
}
