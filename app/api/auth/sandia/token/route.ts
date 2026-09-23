import { NextResponse } from "next/server";
import { createPublicClient, hashMessage, http, isAddress, type Hex } from "viem";
import { isKernelAuthSubject, sandiaLinkMessage } from "@/convex/lib/kernelSubject";
import { assertClaimNonce } from "@/convex/lib/walletClaim";
import { signRs256Jwt } from "@/lib/sandia-jwt";

const ERC1271_MAGIC = "0x1626ba7e";

export async function POST(request: Request) {
  const privateKey = process.env.SANDIA_JWT_PRIVATE_KEY;
  const issuer = process.env.SANDIA_JWT_ISS;
  const audience = process.env.SANDIA_JWT_AUD;
  const secret = process.env.SANDIA_NONCE_SECRET;
  if (!privateKey || !issuer || !audience || !secret) {
    return NextResponse.json({ error: "Sandia JWT signing is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    authSubject?: string;
    smartAccountAddress?: string;
    nonce?: string;
    signature?: string;
  };
  if (!body.authSubject || body.authSubject.length < 8) {
    return NextResponse.json({ error: "authSubject is required" }, { status: 400 });
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(body.authSubject)) {
    return NextResponse.json({ error: "Subject cannot be only an address" }, { status: 400 });
  }
  if (!body.smartAccountAddress || !isAddress(body.smartAccountAddress) || !body.nonce || !body.signature) {
    return NextResponse.json({ error: "Kernel signature is required" }, { status: 400 });
  }
  if (!isKernelAuthSubject(body.authSubject, body.smartAccountAddress)) {
    return NextResponse.json({ error: "Sign-in subject does not match this Kernel" }, { status: 400 });
  }

  try {
    await assertClaimNonce(body.authSubject, body.nonce, secret, Date.now());
  } catch (error) {
    console.error("sandia_nonce_rejected", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sign-in nonce was rejected" },
      { status: 401 },
    );
  }

  const client = createPublicClient({
    transport: http("https://rpc.mainnet.chain.robinhood.com"),
  });
  try {
    const magic = await client.readContract({
      address: body.smartAccountAddress as Hex,
      abi: [
        {
          type: "function",
          name: "isValidSignature",
          stateMutability: "view",
          inputs: [
            { name: "hash", type: "bytes32" },
            { name: "signature", type: "bytes" },
          ],
          outputs: [{ name: "magicValue", type: "bytes4" }],
        },
      ] as const,
      functionName: "isValidSignature",
      args: [hashMessage(sandiaLinkMessage(body.nonce)), body.signature as Hex],
    });
    if (magic.toLowerCase() !== ERC1271_MAGIC) {
      return NextResponse.json({ error: "Smart account did not sign this link" }, { status: 401 });
    }
  } catch (error) {
    console.error("sandia_jwt_signature_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Smart account signature could not be checked" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signRs256Jwt(
    {
      iss: issuer,
      sub: body.authSubject,
      aud: audience,
      iat: now,
      exp: now + 15 * 60,
    },
    privateKey.replace(/\\n/g, "\n"),
  );
  return NextResponse.json({ token });
}
