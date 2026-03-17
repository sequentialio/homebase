import { Skeleton } from "@/components/ui/skeleton"

export default function FinancesLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header + tabs */}
      <Skeleton className="h-8 w-36" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      {/* Table header */}
      <div className="rounded-lg border">
        <div className="p-4 flex gap-4">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24 ml-auto" />
        </div>
        {/* Table rows */}
        <div className="border-t divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
