// In production on Vercel the dashboard is HTTPS but the gateway is HTTP-only
// (no domain yet). Browsers block HTTPS→HTTP fetches as mixed content, so we
// proxy through Vercel's edge: `vercel.json` rewrites `/api/*` → the gateway.
// Override with NEXT_PUBLIC_API_URL for local dev (`npm run dev` uses http://localhost:3000).
const BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "/api"
    : "http://localhost:3000");

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
  const res = await fetch(`${BASE}${path}`, {
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
};
