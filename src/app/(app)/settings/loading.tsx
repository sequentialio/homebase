import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-8 w-28" />
      {/* Profile section */}
      <div className="rounded-lg border p-6 space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-9 w-full max-w-sm" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      {/* Integration section */}
      <div className="rounded-lg border p-6 space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  )
}
