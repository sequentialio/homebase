import { Skeleton } from "@/components/ui/skeleton"

export default function HouseholdLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <Skeleton className="h-8 w-36" />
      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      {/* Search + add button */}
      <div className="flex gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-28 ml-auto" />
      </div>
      {/* List items */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 ml-auto rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
