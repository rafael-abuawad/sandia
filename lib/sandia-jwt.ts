import { createPrivateKey, createPublicKey, createSign, type JsonWebKey } from "crypto";

function b64url(value: string | Buffer): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64url");
}

export function signRs256Jwt(
  payload: Record<string, string | number>,
  privateKeyPem: string,
): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "sandia" }));
  const body = b64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${body}`);
  signer.end();
  const signature = signer.sign(createPrivateKey(privateKeyPem)).toString("base64url");
  return `${header}.${body}.${signature}`;
}

export function publicJwk(publicKeyPem: string): JsonWebKey & { alg: string; use: string; kid: string } {
  const jwk = createPublicKey(publicKeyPem).export({ format: "jwk" }) as JsonWebKey;
  return { ...jwk, alg: "RS256", use: "sig", kid: "sandia" };
}
