/** HttpOnly session cookie — never readable from browser JS. */
export const SESSION_COOKIE_NAME = "payrequest_session";

/** Legacy localStorage key; cleared on hydrate after cookie migration. */
export const LEGACY_SESSION_STORAGE_KEY = "payrequest_session_token";

export const SESSION_COOKIE_PATH = "/";

export function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: SESSION_COOKIE_PATH,
    expires: new Date(expiresAt),
  };
}
