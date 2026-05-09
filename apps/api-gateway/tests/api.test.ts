import { describe, expect, test } from "vitest";
import { buildApp } from "../src/index.js";
import { MemoryStore, type Institution } from "../src/store/index.js";

function hex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const SPEND_PUB = hex(
  "616e237719716e25ead63d831f9117f79b5aa05af8be30ff0eddb3dc43e8bdcf",
);
const VIEW_PUB = hex(
  "3e97bbe3dad77cdbab3b9d7a5af963868b2ee668470874b566dad4a32076c98b",
);

async function setup() {
  const store = new MemoryStore();
  const inst: Institution = {
    id: "test_bank",
    apiKey: "test-key",
    spendPub: SPEND_PUB,
    viewPub: VIEW_PUB,
    releaseAuthority: new Uint8Array(32),
    webhookUrl: null,
  };
  await store.putInstitution(inst);
  const app = buildApp(store);
  return { store, app };
}

async function authedRequest(
  app: ReturnType<typeof buildApp>,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-api-key": "test-key",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("api gateway", () => {
  test("rejects requests with no api key", async () => {
    const { app } = await setup();
    const res = await app.request("/v1/treasury/deposits");
    expect(res.status).toBe(401);
  });

  test("rejects unknown api key", async () => {
    const { app } = await setup();
    const res = await app.request("/v1/treasury/deposits", {
      headers: { "x-api-key": "nope" },
    });
    expect(res.status).toBe(401);
  });

  test("creates a receiving address and exposes payment status", async () => {
    const { app } = await setup();
    const refundAddr = "00".repeat(32);

    const create = await authedRequest(app, "POST", "/v1/receiving-address", {
      customer_id: "C-1234",
      amount_hint: "100000000",
      mint: "USDC",
      expire_seconds: 3600,
      refund_addr_hex: refundAddr,
    });
    expect(create.status).toBe(200);
    const body = (await create.json()) as {
      deposit_id: string;
      stealth_pubkey_hex: string;
      ephemeral_r_hex: string;
      view_tag: number;
    };
    expect(body.deposit_id).toMatch(/^dep_/);
    expect(body.stealth_pubkey_hex).toMatch(/^[0-9a-f]{64}$/);
    expect(body.ephemeral_r_hex).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof body.view_tag).toBe("number");

    const status = await authedRequest(
      app,
      "GET",
      `/v1/payment-status/${body.deposit_id}`,
    );
    expect(status.status).toBe(200);
    const sbody = (await status.json()) as { state: string };
    expect(sbody.state).toBe("pending");
  });

  test("each receiving-address call returns a fresh stealth pubkey", async () => {
    const { app } = await setup();
    const refundAddr = "01".repeat(32);
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await authedRequest(app, "POST", "/v1/receiving-address", {
        customer_id: `C-${i}`,
        amount_hint: "1",
        mint: "SOL",
        expire_seconds: 60,
        refund_addr_hex: refundAddr,
      });
      const body = (await res.json()) as { stealth_pubkey_hex: string };
      seen.add(body.stealth_pubkey_hex);
    }
    expect(seen.size).toBe(5);
  });

  test("release blocked while deposit is pending; works after approval", async () => {
    const { app, store } = await setup();
    const create = await authedRequest(app, "POST", "/v1/receiving-address", {
      customer_id: "C-9",
      amount_hint: "1",
      mint: "SOL",
      expire_seconds: 60,
      refund_addr_hex: "ab".repeat(32),
    });
    const { deposit_id } = (await create.json()) as { deposit_id: string };

    const res = await authedRequest(app, "POST", "/v1/release", {
      deposit_id,
      target_addr_hex: "cd".repeat(32),
    });
    expect(res.status).toBe(409);

    await store.setDepositState(deposit_id, "approved");
    const ok = await authedRequest(app, "POST", "/v1/release", {
      deposit_id,
      target_addr_hex: "cd".repeat(32),
    });
    expect(ok.status).toBe(200);
  });

  test("internal endpoint applies on-chain match by stealth pubkey", async () => {
    const { app } = await setup();
    const refundAddr = "00".repeat(32);

    const create = await authedRequest(app, "POST", "/v1/receiving-address", {
      customer_id: "C-internal",
      amount_hint: "1000",
      mint: "SOL",
      expire_seconds: 600,
      refund_addr_hex: refundAddr,
    });
    const created = (await create.json()) as {
      deposit_id: string;
      stealth_pubkey_hex: string;
    };

    const internal = await app.request("/v1/internal/deposit-detected", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": "dev-internal-secret-rotate",
      },
      body: JSON.stringify({
        slice_id: 1,
        deposit_pubkey: "FakeOnChainPubkey1111111111111111111111111111",
        stealth_pubkey: created.stealth_pubkey_hex,
        amount: 1000,
        state: "approved",
      }),
    });
    expect(internal.status).toBe(200);
    const ack = (await internal.json()) as { gateway_state: string };
    expect(ack.gateway_state).toBe("approved");

    const status = await authedRequest(
      app,
      "GET",
      `/v1/payment-status/${created.deposit_id}`,
    );
    const sb = (await status.json()) as { state: string; on_chain_address: string };
    expect(sb.state).toBe("approved");
    expect(sb.on_chain_address).toBe("FakeOnChainPubkey1111111111111111111111111111");
  });
});
