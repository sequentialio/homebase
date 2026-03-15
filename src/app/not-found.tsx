import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="text-lg text-muted-foreground max-w-sm">
        This page doesn&apos;t exist or has been moved.
      </p>
      <Button asChild className="mt-4">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  )
}
