const GT_NETWORK = "robinhood";

function geckoTokenUrl(address: string, embed: boolean): string {
  const url = new URL(`https://www.geckoterminal.com/${GT_NETWORK}/tokens/${address}`);
  if (embed) {
    url.searchParams.set("embed", "1");
    url.searchParams.set("info", "0");
    url.searchParams.set("swaps", "0");
    url.searchParams.set("light_chart", "1");
  }
  return url.toString();
}

export function PriceChart({ address, symbol }: { address: string; symbol: string }) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-panel-elevated">
        <iframe
          title={`${symbol} price chart`}
          src={geckoTokenUrl(address, true)}
          className="h-[420px] w-full border-0 sm:h-[480px]"
          // TradingView needs the embed's own origin for localStorage. Without
          // allow-same-origin the chart stays on the gray placeholder.
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-write; fullscreen"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
