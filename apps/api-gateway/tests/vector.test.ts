import { describe, expect, test } from "vitest";
import {
  deriveStealthAddressDeterministic,
  publicKeyFromScalar,
} from "../src/stealth.js";

function hex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function bytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const SPEND_PRIV = bytes(
  "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f00",
);
const VIEW_PRIV = bytes(
  "a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbe00",
);
const R_SEED = bytes(
  "2122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40" +
    "4142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f60",
);

const EXPECTED = {
  spendPub: "616e237719716e25ead63d831f9117f79b5aa05af8be30ff0eddb3dc43e8bdcf",
  viewPub: "3e97bbe3dad77cdbab3b9d7a5af963868b2ee668470874b566dad4a32076c98b",
  stealthPub:
    "20fa85036bcc5661f62af10c241ee8243e2543735e7e869c58df13b02f3c26c3",
  ephemeralR:
    "21c24081dfbed643c24ca431092386e1cb0830937d5b4f4cc0d6f366586338b0",
  viewTag: 0xbf,
};

describe("stealth-core TS port matches Rust canonical vector", () => {
  test("public keys derive correctly", () => {
    expect(hex(publicKeyFromScalar(SPEND_PRIV))).toBe(EXPECTED.spendPub);
    expect(hex(publicKeyFromScalar(VIEW_PRIV))).toBe(EXPECTED.viewPub);
  });

  test("deterministic stealth address matches Rust output byte-for-byte", () => {
    const spendPub = publicKeyFromScalar(SPEND_PRIV);
    const viewPub = publicKeyFromScalar(VIEW_PRIV);
    const addr = deriveStealthAddressDeterministic(
      spendPub,
      viewPub,
      R_SEED,
      7n,
    );
    expect(hex(addr.stealthPubkey)).toBe(EXPECTED.stealthPub);
    expect(hex(addr.ephemeralR)).toBe(EXPECTED.ephemeralR);
    expect(addr.viewTag).toBe(EXPECTED.viewTag);
  });
});
