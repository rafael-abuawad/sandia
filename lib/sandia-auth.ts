export function passkeyRpId(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return new URL(raw).hostname;
  } catch {
    return "localhost";
  }
}
