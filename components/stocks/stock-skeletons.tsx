import { Breadcrumbs, stockBreadcrumbItems } from "@/components/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";

const LIST_ROWS = 8;

export function StockListDesktopSkeletonRows() {
  return Array.from({ length: LIST_ROWS }, (_, index) => (
    <tr key={index} className="border-be border-border last:border-be-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ms-auto h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ms-auto h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-14 rounded-sm" />
      </td>
    </tr>
  ));
}

export function StockListMobileSkeletonItems() {
  return Array.from({ length: LIST_ROWS }, (_, index) => (
    <li key={index} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-4 w-16" />
    </li>
  ));
}

export function StockListDesktopSkeleton() {
  return (
    <div className="hidden md:block">
      <table className="w-full border-collapse text-start text-sm">
        <thead className="border-be border-border bg-[var(--panel-elevated)]">
          <tr>
            <th className="px-4 py-3">
              <Skeleton className="h-3 w-12" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="ms-auto h-3 w-10" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="ms-auto h-3 w-14" />
            </th>
            <th className="px-4 py-3">
              <Skeleton className="h-3 w-12" />
            </th>
          </tr>
        </thead>
        <tbody>
          <StockListDesktopSkeletonRows />
        </tbody>
      </table>
    </div>
  );
}

export function StockListMobileSkeleton() {
  return (
    <ul className="divide-y divide-border md:hidden">
      <StockListMobileSkeletonItems />
    </ul>
  );
}

export function StocksMarketSkeleton() {
  return (
    <div className="pr-page" role="status" aria-label="Loading stocks" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-28 sm:h-9" />
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="pr-panel overflow-clip">
        <StockListDesktopSkeleton />
        <StockListMobileSkeleton />
      </div>
    </div>
  );
}

export function StockDetailSkeleton({ symbol }: { symbol?: string }) {
  return (
    <div className="pr-page gap-6" role="status" aria-label="Loading stock" aria-busy="true">
      <Breadcrumbs items={stockBreadcrumbItems(symbol)} />

      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-5 w-14 rounded-sm" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>

      <Skeleton className="h-[420px] w-full rounded-[var(--radius-lg)] sm:h-[480px]" />

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="ms-auto h-3 w-20" />
            <Skeleton className="ms-auto h-5 w-16" />
          </div>
        </div>
        <Skeleton className="h-1 w-full rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>

      <Skeleton className="h-5 w-36" />

      <div className="space-y-3 rounded-[var(--radius-xl)] border border-border p-4">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-6 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
