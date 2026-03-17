import { Skeleton } from "@/components/ui/skeleton"

export default function AssistantLoading() {
  return (
    <div className="flex flex-col h-full p-4 md:p-6 gap-4">
      <Skeleton className="h-8 w-40" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Skeleton className="h-16 w-72 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  )
}
