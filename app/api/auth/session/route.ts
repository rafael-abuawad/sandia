import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session-cookie";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Hydrate client auth from the HttpOnly session cookie.
 * The token is returned once into React memory for Convex calls;
 * it is never written to localStorage/sessionStorage.
 */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value ?? null;
  return NextResponse.json({ token });
}

/** Persist a Convex session token in an HttpOnly cookie after SIWE. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token =
    typeof body === "object" &&
    body !== null &&
    "token" in body &&
    typeof (body as { token: unknown }).token === "string"
      ? (body as { token: string }).token
      : null;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const expiresAt =
    typeof body === "object" &&
    body !== null &&
    "expiresAt" in body &&
    typeof (body as { expiresAt: unknown }).expiresAt === "number"
      ? (body as { expiresAt: number }).expiresAt
      : Date.now() + DEFAULT_TTL_MS;

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));

  return NextResponse.json({ ok: true });
}

/** Clear the HttpOnly session cookie on sign-out. */
export async function DELETE() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(Date.now() - 1000),
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
