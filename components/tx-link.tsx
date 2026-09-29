import { ExternalLink } from "lucide-react";
import { explorerTxUrl } from "@/lib/chains";
import { cn } from "@/lib/utils";

export function TxLink({
  chainId,
  hash,
  children,
  className,
}: {
  chainId: number;
  hash: string;
  children: React.ReactNode;
  className?: string;
}) {
  const href = explorerTxUrl(chainId, hash);
  if (!href) {
    return <span className={cn("pr-mono", className)}>{children}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`View transaction ${hash} on the block explorer`}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1.5 pr-mono text-foreground underline-offset-2 hover:underline",
        className,
      )}
    >
      <span className="min-w-0 break-all">{children}</span>
      <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
    </a>
  );
}
