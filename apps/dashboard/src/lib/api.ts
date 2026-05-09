// On any non-localhost browser (Vercel prod / preview / staging), always
// hit the same-origin `/api` proxy defined in `vercel.json`. This keeps
// the bundle on HTTPS-only origins and avoids mixed-content blocks even
// if NEXT_PUBLIC_API_URL got set to an http:// gateway by mistake.
// Localhost dev keeps talking to the local gateway directly.
function resolveBase(): string {
  if (typeof window === "undefined") return "/api";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  }
  return "/api";
}

export interface ReceivingAddressResponse {
  deposit_id: string;
  stealth_pubkey_hex: string;
  ephemeral_r_hex: string;
  view_tag: number;
  expires_at: number;
}

export interface PaymentStatusResponse {
  deposit_id: string;
  state: "pending" | "approved" | "rejected" | "released" | "refunded" | "expired";
  amount_hint: string;
  stealth_pubkey_hex: string;
  view_tag: number;
  expires_at: number;
  on_chain_address: string | null;
  on_chain_amount: string | null;
  on_chain_state: string | null;
}

export interface TreasurySummaryResponse {
  total: number;
  by_state: Record<string, number>;
}

export interface CreateAddressBody {
  customer_id: string;
  amount_hint: string;
  mint: string;
  expire_seconds: number;
  refund_addr_hex: string;
}

export interface ReleaseBody {
  deposit_id: string;
  target_addr_hex: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

async function request<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${resolveBase()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.detail);
  }
  return body as T;
}

export interface DemoSimulateResponse {
  stage: "simulate";
  signature: string;
  deposit_pda: string;
  explorer_tx: string | null;
  explorer_account: string | null;
}

export interface DemoAttestResponse {
  stage: "attest";
  verdict: "clean" | "dirty";
  signatures: string[];
  explorer_txs: string[];
}

export interface DemoReleaseResponse {
  stage: "release";
  signature: string;
  target: string;
  explorer_tx: string | null;
  explorer_target: string | null;
}

export interface DemoRefundResponse {
  stage: "refund";
  signature: string;
  refund_target: string;
  explorer_tx: string | null;
}

export const api = {
  createReceivingAddress: (apiKey: string, body: CreateAddressBody) =>
    request<ReceivingAddressResponse>(apiKey, "/v1/receiving-address", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  paymentStatus: (apiKey: string, id: string) =>
    request<PaymentStatusResponse>(apiKey, `/v1/payment-status/${id}`),

  release: (apiKey: string, body: ReleaseBody) =>
    request<{ deposit_id: string; state: string; target_addr_hex: string }>(
      apiKey,
      "/v1/release",
      { method: "POST", body: JSON.stringify(body) },
    ),

  refund: (apiKey: string, depositId: string) =>
    request<{ deposit_id: string; state: string; refund_addr_hex: string }>(
      apiKey,
      "/v1/refund",
      { method: "POST", body: JSON.stringify({ deposit_id: depositId }) },
    ),

  treasurySummary: (apiKey: string) =>
    request<TreasurySummaryResponse>(apiKey, "/v1/treasury/deposits"),

  demoSimulate: (apiKey: string, depositId: string) =>
    request<DemoSimulateResponse>(apiKey, "/v1/demo/simulate-payment", {
      method: "POST",
      body: JSON.stringify({ deposit_id: depositId }),
    }),

  demoAttest: (apiKey: string, depositId: string, verdict: "clean" | "dirty") =>
    request<DemoAttestResponse>(apiKey, "/v1/demo/attest", {
      method: "POST",
      body: JSON.stringify({ deposit_id: depositId, verdict }),
    }),

  demoRelease: (apiKey: string, depositId: string) =>
    request<DemoReleaseResponse>(apiKey, "/v1/demo/release", {
      method: "POST",
      body: JSON.stringify({ deposit_id: depositId }),
    }),

  demoRefund: (apiKey: string, depositId: string) =>
    request<DemoRefundResponse>(apiKey, "/v1/demo/refund", {
      method: "POST",
      body: JSON.stringify({ deposit_id: depositId }),
    }),
};
