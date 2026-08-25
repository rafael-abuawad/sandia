import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AppBrand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("pr-brand inline-flex items-center gap-2", className)}>
      <Image
        src="/logo.svg"
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0"
        priority
        unoptimized
      />
      Payrequest
    </Link>
  );
}
