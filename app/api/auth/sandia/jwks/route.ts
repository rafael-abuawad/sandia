import { NextResponse } from "next/server";
import { publicJwk } from "@/lib/sandia-jwt";

export function GET() {
  const pem = process.env.SANDIA_JWT_PUBLIC_KEY;
  if (!pem) {
    return NextResponse.json({ error: "Sandia JWKS is not configured" }, { status: 503 });
  }
  return NextResponse.json({ keys: [publicJwk(pem.replace(/\\n/g, "\n"))] });
}
