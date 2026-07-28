/** Hardcoded destination for payment requests — Across on Robinhood currently settles USDG. */
export const ROBINHOOD_USDG = {
  symbol: "USDG",
  name: "Global Dollar",
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  decimals: 6,
  chainId: 4663,
  chainName: "Robinhood",
  /** Official USDG mark (Global Dollar). */
  logoUrl:
    "data:image/svg+xml,%3csvg%20viewBox='0%200%20194%20195'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3ccircle%20cx='96.8933'%20cy='97.2009'%20r='96.8386'%20fill='%23314012'/%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M168.887%20102.452C166.099%20139.698%20134.987%20169.051%2097.0161%20169.051C57.2109%20169.051%2024.9424%20136.793%2024.9424%2097.0002C24.9424%2057.2075%2057.2109%2024.9492%2097.0161%2024.9492C134.924%2024.9492%20165.997%2054.2062%20168.873%2091.3651H134.414C141.936%2074.7437%20142.391%2059.6421%20134.165%2052.7419C122.017%2042.5517%2095.537%2054.1062%2075.0201%2078.5496C54.5032%20102.993%2047.7189%20131.069%2059.8668%20141.259C72.0148%20151.449%2098.4949%20139.895%20119.012%20115.451C122.588%20111.191%20125.747%20106.82%20128.461%20102.452H168.887Z'%20fill='%23C7E36C'/%3e%3cpath%20d='M102.43%20102.452H131.251L120.121%20117.025L102.43%20109.924V102.452Z'%20fill='%23C7E36C'/%3e%3c/svg%3e",
  chainLogoUrl: "https://alexandria-blond.vercel.app/assets/chains/robinhood.svg",
} as const;
