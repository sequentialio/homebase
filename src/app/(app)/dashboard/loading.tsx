import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Greeting */}
      <Skeleton className="h-8 w-56" />
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      {/* Alerts row */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      {/* Two-column: transactions + calendar */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border p-4 space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-48" />
          ))}
        </div>
      </div>
    </div>
  )
}
