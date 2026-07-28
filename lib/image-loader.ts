/**
 * Passthrough loader for third-party token/chain logos (Across CDNs, etc.).
 * Keeps next/image for sizing/lazy-load while allowing arbitrary https hosts.
 */
export default function imageLoader({ src }: { src: string; width: number; quality?: number }) {
  return src;
}
