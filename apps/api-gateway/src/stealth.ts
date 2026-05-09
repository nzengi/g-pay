import { ed25519 } from "@noble/curves/ed25519";
import { sha512 } from "@noble/hashes/sha512";

const enc = new TextEncoder();
const DOMAIN_SHARED = enc.encode("g-pay/stealth/shared/v1");
const DOMAIN_OFFSET = enc.encode("g-pay/stealth/offset/v1");
const DOMAIN_VIEW_TAG = enc.encode("g-pay/stealth/view-tag/v1");

const L = ed25519.CURVE.n;

export interface StealthAddress {
  stealthPubkey: Uint8Array;
  ephemeralR: Uint8Array;
  viewTag: number;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function scalarFromBytesWide(bytes: Uint8Array): bigint {
  if (bytes.length !== 64) {
    throw new Error(`expected 64 bytes, got ${bytes.length}`);
  }
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    n = (n << 8n) | BigInt(bytes[i] as number);
  }
  return n % L;
}

function hashPoint(domain: Uint8Array, pointBytes: Uint8Array): Uint8Array {
  return sha512(concat(domain, pointBytes)).slice(0, 32);
}

function scalarFromHash(
  domain: Uint8Array,
  shared: Uint8Array,
  nonce: bigint,
): bigint {
  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, nonce, true);
  const wide = sha512(concat(domain, shared, nonceBytes));
  return scalarFromBytesWide(wide);
}

function viewTagOf(shared: Uint8Array): number {
  return sha512(concat(DOMAIN_VIEW_TAG, shared))[0] as number;
}

/**
 * Mirror of `stealth_core::derive_stealth_address_deterministic`.
 * Inputs and outputs are byte-exact with the Rust implementation; verified by
 * `tests/vector.test.ts` against the canonical vector emitted by the Rust crate.
 */
export function deriveStealthAddressDeterministic(
  spendPub: Uint8Array,
  viewPub: Uint8Array,
  rSeed: Uint8Array,
  nonce: bigint,
): StealthAddress {
  const r = scalarFromBytesWide(rSeed);
  const G = ed25519.ExtendedPoint.BASE;

  const rPub = G.multiply(r);
  const viewPoint = ed25519.ExtendedPoint.fromHex(viewPub);
  const sharedPoint = viewPoint.multiply(r);

  const shared = hashPoint(DOMAIN_SHARED, sharedPoint.toRawBytes());
  const offset = scalarFromHash(DOMAIN_OFFSET, shared, nonce);

  const offsetPoint = G.multiply(offset);
  const spendPoint = ed25519.ExtendedPoint.fromHex(spendPub);
  const stealthPoint = spendPoint.add(offsetPoint);

  return {
    stealthPubkey: stealthPoint.toRawBytes(),
    ephemeralR: rPub.toRawBytes(),
    viewTag: viewTagOf(shared),
  };
}

/** Generate a fresh stealth address using crypto.getRandomValues for r. */
export function deriveStealthAddress(
  spendPub: Uint8Array,
  viewPub: Uint8Array,
  nonce: bigint = 0n,
): StealthAddress {
  const rSeed = new Uint8Array(64);
  crypto.getRandomValues(rSeed);
  return deriveStealthAddressDeterministic(spendPub, viewPub, rSeed, nonce);
}

export function publicKeyFromScalar(privBytes: Uint8Array): Uint8Array {
  if (privBytes.length !== 32) {
    throw new Error(`expected 32-byte scalar, got ${privBytes.length}`);
  }
  let n = 0n;
  for (let i = privBytes.length - 1; i >= 0; i--) {
    n = (n << 8n) | BigInt(privBytes[i] as number);
  }
  const reduced = n % L;
  return ed25519.ExtendedPoint.BASE.multiply(reduced).toRawBytes();
}
