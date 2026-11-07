/**
 * Minimal StrKey codec. Stellar addresses are case-sensitive, so callers must never lowercase them.
 * This has no SDK dependency, which lets it run inside Convex queries and mutations.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const VERSION_ACCOUNT = 6 << 3;
const VERSION_MUXED = 12 << 3;

function crc16(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function base32Decode(value: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let buffer = 0;
  for (const char of value) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  // Canonical encodings leave only zero padding bits.
  if (buffer !== 0) return null;
  return Uint8Array.from(out);
}

function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let bits = 0;
  let buffer = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) out += ALPHABET[(buffer << (5 - bits)) & 31];
  return out;
}

function decode(value: string, version: number, payloadLength: number): Uint8Array | null {
  const raw = base32Decode(value);
  if (!raw || raw.length !== payloadLength + 3 || raw[0] !== version) return null;
  const body = raw.subarray(0, payloadLength + 1);
  const checksum = raw[payloadLength + 1] | (raw[payloadLength + 2] << 8);
  if (crc16(body) !== checksum) return null;
  return raw.subarray(1, payloadLength + 1);
}

function encode(version: number, payload: Uint8Array): string {
  const body = new Uint8Array(payload.length + 1);
  body[0] = version;
  body.set(payload, 1);
  const checksum = crc16(body);
  const full = new Uint8Array(body.length + 2);
  full.set(body);
  full[body.length] = checksum & 0xff;
  full[body.length + 1] = checksum >> 8;
  return base32Encode(full);
}

/** A funded-account style `G…` address. */
export function isStellarAccount(value: string): boolean {
  return value.length === 56 && value[0] === "G" && decode(value, VERSION_ACCOUNT, 32) !== null;
}

/** A muxed `M…` address, used by exchanges to label deposits. */
export function isMuxedAccount(value: string): boolean {
  return value.length === 69 && value[0] === "M" && decode(value, VERSION_MUXED, 40) !== null;
}

/** Anything a USDC payment can be addressed to. */
export function isStellarRecipient(value: string): boolean {
  return isStellarAccount(value) || isMuxedAccount(value);
}

export function accountPublicKey(address: string): Uint8Array {
  const key = decode(address, VERSION_ACCOUNT, 32);
  if (!key) throw new Error("Invalid Stellar address");
  return key;
}

/** The `G…` account behind a `G…` or `M…` address. Horizon and trustlines work on this account. */
export function baseAccount(address: string): string {
  if (isStellarAccount(address)) return address;
  const muxed = decode(address, VERSION_MUXED, 40);
  if (!muxed) throw new Error("Invalid Stellar address");
  return encode(VERSION_ACCOUNT, muxed.subarray(0, 32));
}

/** Trims whitespace and validates a recipient. Case is significant and is preserved. */
export function normalizeRecipient(value: string): string {
  const trimmed = value.trim();
  if (!isStellarRecipient(trimmed)) throw new Error("Enter a valid Stellar address");
  return trimmed;
}
