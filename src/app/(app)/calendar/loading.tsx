import { Skeleton } from "@/components/ui/skeleton"

export default function CalendarLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header with month nav */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="border rounded-sm p-2 min-h-[80px]">
            <Skeleton className="h-4 w-6 mb-2" />
            {i % 5 === 0 && <Skeleton className="h-3 w-full" />}
            {i % 7 === 2 && <Skeleton className="h-3 w-3/4" />}
          </div>
        ))}
      </div>
    </div>
  )
}
