import { Skeleton } from "@/components/ui/skeleton";

function DesktopRow() {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ml-auto h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ml-auto h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ml-auto h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-14 rounded-sm" />
      </td>
    </tr>
  );
}

function MobileRow() {
  return (
    <li className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="min-w-0 space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="shrink-0 space-y-1">
        <Skeleton className="ml-auto h-4 w-16" />
        <Skeleton className="ml-auto h-3 w-14" />
      </div>
    </li>
  );
}

export default function Loading() {
  return (
    <div
      className="pr-page--table mx-auto w-full space-y-5"
      role="status"
      aria-label="Loading"
      aria-busy="true"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-28 sm:h-9 sm:w-32" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-4/5 max-w-xl" />
      </div>

      <Skeleton className="h-3 w-56" />

      <div className="pr-panel overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-[var(--panel-elevated)]">
              <tr>
                <th className="px-4 py-3">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="ml-auto h-3 w-10" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="ml-auto h-3 w-12" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="ml-auto h-3 w-16" />
                </th>
                <th className="px-4 py-3">
                  <Skeleton className="h-3 w-12" />
                </th>
              </tr>
            </thead>
            <tbody>
              <DesktopRow />
              <DesktopRow />
              <DesktopRow />
              <DesktopRow />
              <DesktopRow />
              <DesktopRow />
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-border md:hidden">
          <MobileRow />
          <MobileRow />
          <MobileRow />
          <MobileRow />
          <MobileRow />
          <MobileRow />
        </ul>
      </div>
    </div>
  );
}
