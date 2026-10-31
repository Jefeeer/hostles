import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly on every portal page change while the page's data loads.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 border-b pb-5">
        <Skeleton className="mb-3 h-3 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
