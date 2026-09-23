import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { kernelAuthSubject } from "@/convex/lib/kernelSubject";
import { signClaimNonce } from "@/convex/lib/walletClaim";

export async function POST(request: Request) {
  const secret = process.env.SANDIA_NONCE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Sandia nonce signing is not configured" }, { status: 503 });
  }

  let body: { smartAccountAddress?: string };
  try {
    body = (await request.json()) as { smartAccountAddress?: string };
  } catch (error) {
    console.error("sandia_nonce_invalid_json", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Nonce request was not valid JSON" }, { status: 400 });
  }

  if (!body.smartAccountAddress || !isAddress(body.smartAccountAddress)) {
    return NextResponse.json({ error: "Kernel address is required" }, { status: 400 });
  }

  const expiresAt = Date.now() + 10 * 60 * 1000;
  const nonce = await signClaimNonce(
    kernelAuthSubject(body.smartAccountAddress),
    expiresAt,
    secret,
  );
  return NextResponse.json({ nonce });
}
