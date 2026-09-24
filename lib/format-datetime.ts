/** Stable display locale so SSR and the browser emit the same timestamp text. */
export const DISPLAY_LOCALE = "en-US";
export const DISPLAY_TIME_ZONE = "UTC";

export function formatDisplayDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(DISPLAY_LOCALE, {
    timeZone: DISPLAY_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  });
}
