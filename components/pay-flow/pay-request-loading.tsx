import Image from "next/image";
import { QuoteSkeleton } from "@/components/quote-skeleton";
import { FieldSkeleton } from "@/components/skeletons/field-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function PayRequestLoading() {
  return (
    <div className="flex flex-col items-center" role="status" aria-live="polite" aria-busy="true">
      <Image
        src="/logo.svg"
        alt=""
        width={148}
        height={199}
        priority
        unoptimized
        className="h-24 w-auto"
      />
      <h1 className="mt-5 pr-display text-center text-2xl text-foreground sm:text-3xl">
        Loading payment request…
      </h1>
      <div
        aria-hidden
        className="mt-8 w-full space-y-5 rounded-xl border border-dashed border-foreground/25 p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
          <Skeleton className="h-5 w-16 rounded-sm" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <QuoteSkeleton />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
