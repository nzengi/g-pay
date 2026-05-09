import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "g-pay · API & developer docs",
  description:
    "REST API, Anchor program reference, and stealth-address derivation spec for g-pay on Solana devnet.",
};

const PROGRAM_ID = "75HuPfb2n7SD7KtcQnVpCW5SVN3RP9gZ9vTXP4D4ha6C";
const API_BASE = "https://g-pay-dashboard.vercel.app/api";
const DEMO_KEY = "demo-key-please-rotate";

export default function DocsPage() {
  return (
    <div className="min-h-full">
      <Header />
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <Toc />
        <main className="min-w-0 space-y-16">
          <Hero />
          <WhatItDoes />
          <Architecture />
          <QuickStart />
          <RestApi />
          <DemoApi />
          <OnChain />
          <StealthMath />
          <IndexerRelayer />
          <Security />
          <Resources />
        </main>
      </div>
      <Footer />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />
          g-pay
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="px-3 h-9 inline-flex items-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
          >
            Demo
          </Link>
          <span className="px-3 h-9 inline-flex items-center rounded-md bg-[var(--surface-2)]">
            Docs
          </span>
          <a
            href="https://github.com/nzengi/g-pay"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 h-9 inline-flex items-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
          >
            GitHub ↗
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-16 px-6 py-6 text-xs text-[var(--muted)]">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>
          Solana devnet · Anchor program{" "}
          <ExternalLink href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}>
            {PROGRAM_ID.slice(0, 10)}…{PROGRAM_ID.slice(-6)}
          </ExternalLink>
        </div>
        <div>Pre-audit. Devnet only. See SECURITY.md.</div>
      </div>
    </footer>
  );
}

function Toc() {
  const items: [string, string][] = [
    ["overview", "Overview"],
    ["what", "What it does"],
    ["architecture", "Architecture"],
    ["quickstart", "Quick start"],
    ["api", "REST API"],
    ["demo-api", "Demo API"],
    ["onchain", "Anchor program"],
    ["stealth", "Stealth-address math"],
    ["pipeline", "Indexer & relayer"],
    ["security", "Security"],
    ["resources", "Resources"],
  ];
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-6 text-sm">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
          On this page
        </div>
        <ul className="space-y-1">
          {items.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block py-1 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section id="overview" className="space-y-6 scroll-mt-20">
      <div className="inline-flex items-center gap-2 px-3 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
        Solana devnet · live
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        API & developer docs
      </h1>
      <p className="text-base text-[var(--muted)] max-w-2xl">
        Everything you need to integrate, judge, or fork g-pay. Each endpoint
        below is wired to a live deployment on Solana devnet — copy any{" "}
        <code className="mono text-[var(--foreground)]">curl</code> block and
        run it locally.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="h-10 px-4 inline-flex items-center rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90"
        >
          Try the live demo →
        </Link>
        <ExternalLink
          href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
          variant="button"
        >
          On-chain program ↗
        </ExternalLink>
        <ExternalLink href="https://github.com/nzengi/g-pay" variant="button">
          Source on GitHub ↗
        </ExternalLink>
      </div>
    </section>
  );
}

function WhatItDoes() {
  return (
    <section id="what" className="space-y-4 scroll-mt-20">
      <SectionHeading>What it does</SectionHeading>
      <p className="text-sm leading-7">
        Imagine a bank that accepts a Solana payment from a wallet which is
        added to an OFAC sanctions list six months later. The bank&apos;s
        treasury is now linked, on-chain, to a sanctioned entity. Lawsuit.
        Remediation costs. The risk is not the amount — it&apos;s the address.
      </p>
      <p className="text-sm leading-7">
        g-pay puts an AML attestation gate <em>before</em> any funds touch a
        treasury address, and uses a fresh stealth address per payment so there
        is no on-chain link between sender, receiver, or the institution&apos;s
        main funds. Released funds land on a brand-new pubkey, never
        consolidated. The whole stack is non-ZK — three classical Solana
        primitives wired together.
      </p>
      <Callout tone="warn">
        Status: pre-audit, <strong>devnet only</strong>. The Anchor program has
        not undergone third-party review; the AML oracle is a stub. See{" "}
        <ExternalLink href="https://github.com/nzengi/g-pay/blob/main/SECURITY.md">
          SECURITY.md
        </ExternalLink>{" "}
        before any real value flows.
      </Callout>
    </section>
  );
}

function Architecture() {
  return (
    <section id="architecture" className="space-y-4 scroll-mt-20">
      <SectionHeading>Architecture</SectionHeading>
      <p className="text-sm leading-7">
        Three primitives: <strong>Ed25519 stealth addresses</strong> (per-payment
        receive address), a <strong>quarantine vault</strong> Anchor program
        (escrow with m-of-n AML attestation), and a{" "}
        <strong>hyperscaled treasury</strong> (no consolidation: each release
        lands on a fresh pubkey).
      </p>
      <CodeBlock>
        {`SOLANA  (devnet)
   programs/quarantine-vault/      Anchor program (8 ix; SOL + Token + Token-2022)
        ▲
        │ RPC
        ▼
SERVER stack  (Docker compose)
   api-gateway   Hono + Postgres   public REST API
   indexer       Rust              getProgramAccounts → view-key match → webhook
   relayer       Rust + Axum       fee-payer cosign + admission policy
   postgres                         institutions / deposits / audit log
   redis                            rate-limit / queue (V2)
   caddy                            HTTP reverse proxy

DASHBOARD  (Vercel)
   apps/dashboard                   Next.js 16 + Tailwind, /api proxy → server`}
      </CodeBlock>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function QuickStart() {
  return (
    <section id="quickstart" className="space-y-4 scroll-mt-20">
      <SectionHeading>Quick start (60 seconds, terminal)</SectionHeading>
      <p className="text-sm leading-7">
        Five real Solana devnet transactions. Each one is verifiable on Solana
        Explorer. The same flow runs from the dashboard&apos;s &quot;Try the
        live demo&quot; button — the only difference is the buttons replace the
        curls.
      </p>
      <CodeBlock language="bash">
        {`PROXY=${API_BASE}
KEY=${DEMO_KEY}

# 1. Mint a fresh deposit (refund_addr is auto-wired to the on-server demo wallet)
INIT=$(curl -fsS -X POST "$PROXY/v1/demo/init" -H "x-api-key: $KEY")
ID=$(echo "$INIT" | jq -r .deposit_id)
echo "  deposit_id: $ID"

# 2. Simulate a real customer payment on devnet (0.1 SOL → stealth address)
curl -fsS -X POST "$PROXY/v1/demo/simulate-payment" -H "x-api-key: $KEY" \\
  -H "content-type: application/json" -d "{\\"deposit_id\\":\\"$ID\\"}" | jq .explorer_tx

sleep 8  # indexer scan interval

# 3. AML attestation: 2-of-3 oracles sign CLEAN → state moves to Approved
curl -fsS -X POST "$PROXY/v1/demo/attest" -H "x-api-key: $KEY" \\
  -H "content-type: application/json" \\
  -d "{\\"deposit_id\\":\\"$ID\\",\\"verdict\\":\\"clean\\"}" | jq .explorer_txs

sleep 8

# 4. Release to a fresh treasury slice (no consolidation = no on-chain link)
curl -fsS -X POST "$PROXY/v1/demo/release" -H "x-api-key: $KEY" \\
  -H "content-type: application/json" -d "{\\"deposit_id\\":\\"$ID\\"}" | jq .

sleep 7

# 5. Final state — gateway record now mirrors on-chain
curl -fsS "$PROXY/v1/payment-status/$ID" -H "x-api-key: $KEY" | jq .state`}
      </CodeBlock>
      <Callout tone="info">
        Want one-click? The dashboard&apos;s{" "}
        <Link href="/" className="underline">
          /
        </Link>{" "}
        landing page does the exact same calls behind a single button.
      </Callout>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function RestApi() {
  return (
    <section id="api" className="space-y-6 scroll-mt-20">
      <SectionHeading>REST API</SectionHeading>
      <div className="text-sm space-y-2">
        <p>
          <strong>Base URL:</strong>{" "}
          <code className="mono">{API_BASE}</code>
        </p>
        <p>
          <strong>Auth:</strong> every request needs{" "}
          <code className="mono">X-API-Key</code> matching one of the{" "}
          <code className="mono">institutions</code> table rows. The demo
          institution&apos;s key is <code className="mono">{DEMO_KEY}</code>.
        </p>
        <p>
          <strong>Errors:</strong> non-2xx responses are JSON{" "}
          <code className="mono">{`{ error: string, detail?: any }`}</code>.
        </p>
      </div>

      <Endpoint
        method="POST"
        path="/v1/receiving-address"
        summary="Generate a fresh stealth address for one payment."
        body={`{
  "customer_id": "C-1234",
  "amount_hint": "100000000",        // smallest units
  "mint": "USDC",                    // metadata only; SOL via demo flow
  "expire_seconds": 3600,
  "refund_addr_hex": "00".repeat(32) // 32-byte hex
}`}
        response={`{
  "deposit_id": "dep_xxx",
  "stealth_pubkey_hex": "a09243…",
  "ephemeral_r_hex":    "841a55…",
  "view_tag": 115,
  "expires_at": 1778342668574
}`}
        curl={`curl -X POST "${API_BASE}/v1/receiving-address" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"customer_id":"C-1234","amount_hint":"100000000","mint":"USDC","expire_seconds":3600,"refund_addr_hex":"${"00".repeat(
    32,
  )}"}'`}
      />

      <Endpoint
        method="GET"
        path="/v1/payment-status/:id"
        summary="Read a deposit's current state, including any on-chain match recorded by the indexer."
        response={`{
  "deposit_id": "dep_xxx",
  "state": "pending" | "approved" | "rejected" | "released" | "refunded" | "expired",
  "amount_hint": "100000000",
  "stealth_pubkey_hex": "a09243…",
  "view_tag": 115,
  "expires_at": 1778342668574,
  "on_chain_address": "CrKu5EYNCT9c…" | null,
  "on_chain_amount":  "100000000"      | null,
  "on_chain_state":   "pending"        | null
}`}
        curl={`curl "${API_BASE}/v1/payment-status/dep_xxx" -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="GET"
        path="/v1/treasury/deposits"
        summary="Aggregate deposit count by state for the calling institution."
        response={`{ "total": 3, "by_state": { "pending": 1, "released": 2 } }`}
        curl={`curl "${API_BASE}/v1/treasury/deposits" -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="GET"
        path="/v1/treasury/deposits/list?limit=N"
        summary="Paginated list of full deposit records, newest first. Default limit 100, max 500."
        response={`{
  "total": 1,
  "items": [
    {
      "deposit_id": "dep_xxx",
      "customer_id": "C-1234",
      "amount_hint": "100000000",
      "mint": "SOL",
      "stealth_pubkey_hex": "a09243…",
      "view_tag": 115,
      "state": "released",
      "created_at": 1778338767824,
      "expires_at": 1778342367823,
      "on_chain_address": "CrKu5EYNCT…",
      "on_chain_amount":  "100000000",
      "on_chain_state":   "released",
      "on_chain_observed_at": 1778338835946
    }
  ]
}`}
        curl={`curl "${API_BASE}/v1/treasury/deposits/list?limit=20" -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="POST"
        path="/v1/release"
        summary="Mark an Approved deposit as released in the gateway DB. Pair with the on-chain release tx (see /v1/demo/release for the bundled-execution variant)."
        body={`{
  "deposit_id": "dep_xxx",
  "target_addr_hex": "cd".repeat(32)
}`}
        response={`{
  "deposit_id": "dep_xxx",
  "state": "released",
  "target_addr_hex": "cdcd…"
}`}
        curl={`curl -X POST "${API_BASE}/v1/release" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxx","target_addr_hex":"${"cd".repeat(32)}"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/refund"
        summary="Mark a Rejected/Expired deposit as refunded. Returns the on-chain refund destination set at deposit time."
        body={`{ "deposit_id": "dep_xxx" }`}
        response={`{
  "deposit_id": "dep_xxx",
  "state": "refunded",
  "refund_addr_hex": "00…"
}`}
        curl={`curl -X POST "${API_BASE}/v1/refund" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxx"}'`}
      />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function DemoApi() {
  return (
    <section id="demo-api" className="space-y-6 scroll-mt-20">
      <SectionHeading>
        Demo API <DemoBadge />
      </SectionHeading>
      <p className="text-sm leading-7">
        These endpoints execute real Solana devnet transactions on the
        operator&apos;s behalf using server-side keypairs (a demo wallet, two
        oracle signers, and the vault authority). They exist so a hackathon
        judge can verify the full lifecycle without holding any keys, and they
        are{" "}
        <strong>scoped to the bundled demo institution only</strong>. A
        production deployment would replace them with proper webhooks,
        institution-side signers, and an HSM-backed signing service.
      </p>

      <Endpoint
        method="POST"
        path="/v1/demo/init"
        demo
        summary="Create a deposit record with sensible demo defaults: 0.1 SOL, refund_addr pre-wired to the on-server demo wallet, 1-hour expiry."
        response={`{
  "deposit_id": "dep_xxx",
  "stealth_pubkey_hex": "3d0a10…",
  "ephemeral_r_hex":    "048c87…",
  "view_tag": 92,
  "refund_pubkey": "E5sMsf…",
  "expires_at": 1778343825242
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/init" -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/simulate-payment"
        demo
        summary="Submit a real on-chain SOL deposit to the deposit's stealth address. The indexer picks it up within ~5s."
        body={`{ "deposit_id": "dep_xxx" }`}
        response={`{
  "stage": "simulate",
  "signature": "3P1D5m…",
  "deposit_pda": "AXhCPv…",
  "explorer_tx":      "https://explorer.solana.com/tx/3P1D5m…?cluster=devnet",
  "explorer_account": "https://explorer.solana.com/address/AXhCPv…?cluster=devnet"
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/simulate-payment" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxx"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/attest"
        demo
        summary="Two oracles sign an attestation with the given verdict. Threshold (2-of-3) is reached in one call so the on-chain state moves immediately."
        body={`{
  "deposit_id": "dep_xxx",
  "verdict": "clean" | "dirty"
}`}
        response={`{
  "stage": "attest",
  "verdict": "clean",
  "signatures":   ["2HUEki…", "2KR9sW…"],
  "explorer_txs": ["https://explorer.solana.com/tx/2HUEki…?cluster=devnet", "..."]
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/attest" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxx","verdict":"clean"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/release"
        demo
        summary="Release an Approved deposit's lamports to a freshly generated treasury slice (a brand-new pubkey, deliberately not consolidated with prior slices)."
        body={`{ "deposit_id": "dep_xxx" }`}
        response={`{
  "stage": "release",
  "signature": "61guN7…",
  "target": "6vGTSK…",
  "explorer_tx":     "https://explorer.solana.com/tx/61guN7…?cluster=devnet",
  "explorer_target": "https://explorer.solana.com/address/6vGTSK…?cluster=devnet"
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/release" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxx"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/refund"
        demo
        summary="Refund a Rejected/Expired deposit back to the registered refund address (the demo wallet)."
        body={`{ "deposit_id": "dep_xxx" }`}
        response={`{
  "stage": "refund",
  "signature": "...",
  "refund_target": "E5sMsf…",
  "explorer_tx": "https://explorer.solana.com/tx/...?cluster=devnet"
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/refund" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxx"}'`}
      />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function OnChain() {
  return (
    <section id="onchain" className="space-y-6 scroll-mt-20">
      <SectionHeading>Anchor program</SectionHeading>
      <div className="text-sm space-y-2">
        <p>
          <strong>Program ID:</strong>{" "}
          <ExternalLink href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}>
            <span className="mono">{PROGRAM_ID}</span> ↗
          </ExternalLink>
        </p>
        <p>
          <strong>Source:</strong>{" "}
          <ExternalLink href="https://github.com/nzengi/g-pay/tree/main/programs/quarantine-vault">
            programs/quarantine-vault
          </ExternalLink>
        </p>
      </div>

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Instructions (8)
      </h3>
      <Table
        head={["Name", "Signs", "Effect"]}
        rows={[
          [
            "initialize_vault",
            "authority",
            "Creates Vault PDA. Stores oracle_set + min_attestations.",
          ],
          [
            "deposit",
            "depositor",
            "Locks SOL in a Deposit PDA at state = Pending. PDA seed: [\"deposit\", vault, stealth_pubkey, ephemeral_r].",
          ],
          [
            "deposit_token",
            "depositor",
            "SPL Token / Token-2022 variant. Deposits to a per-deposit escrow_token_account whose authority is the Deposit PDA.",
          ],
          [
            "attest",
            "oracle ∈ oracle_set",
            "Records one Attestation. When clean_count ≥ threshold → state = Approved; dirty_count ≥ threshold → Rejected.",
          ],
          [
            "release",
            "release_authority (per-deposit)",
            "Approved → Released. Lamports move to a target pubkey.",
          ],
          [
            "release_token",
            "release_authority",
            "SPL variant. token::transfer_checked from escrow_token_account → target_token_account.",
          ],
          [
            "refund",
            "any caller",
            "Rejected | Expired | (Pending past expire) → Refunded. Sends to deposit.refund_addr.",
          ],
          [
            "refund_token",
            "any caller",
            "SPL variant. Validates refund_target_token_account.owner == deposit.refund_addr.",
          ],
        ]}
      />

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Account types
      </h3>

      <div className="space-y-4">
        <AccountSchema
          name="Vault"
          fields={[
            ["bump", "u8"],
            ["authority", "Pubkey"],
            ["oracle_set", "Vec<Pubkey>", "AML attestor allowlist (max 16)"],
            ["min_attestations", "u8", "m of n threshold"],
            ["paused", "bool"],
            ["deposit_count", "u64"],
          ]}
        />
        <AccountSchema
          name="Deposit"
          fields={[
            ["bump", "u8"],
            ["vault", "Pubkey"],
            ["stealth_pubkey", "Pubkey", "off-chain receive address"],
            ["ephemeral_r", "[u8; 32]", "sender's ephemeral pubkey"],
            ["view_tag", "u8", "1-byte view-key tag (fast prefilter)"],
            ["mint", "Pubkey", "Pubkey::default for SOL deposits"],
            ["amount", "u64"],
            ["depositor", "Pubkey"],
            ["refund_addr", "Pubkey"],
            ["release_authority", "Pubkey"],
            ["created_at / expire_at", "i64"],
            ["state", "DepositState"],
            ["attestations", "Vec<Attestation>", "max 16"],
            ["clean_count / dirty_count", "u8"],
          ]}
        />
      </div>

      <h3 className="text-base font-semibold tracking-tight pt-2">PDA seeds</h3>
      <CodeBlock>
        {`vault           = ["vault",   authority]
deposit         = ["deposit", vault, stealth_pubkey, ephemeral_r]
escrow_token    = ["escrow_token", deposit]   // only for SPL deposits

DepositState  = Pending | Approved | Rejected | Released | Refunded | Expired
AmlVerdict    = Clean | Dirty`}
      </CodeBlock>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function StealthMath() {
  return (
    <section id="stealth" className="space-y-4 scroll-mt-20">
      <SectionHeading>Stealth-address derivation</SectionHeading>
      <p className="text-sm leading-7">
        Cryptonote-style two-key scheme adapted for Curve25519. The institution
        publishes <code className="mono">spend_pub</code> and{" "}
        <code className="mono">view_pub</code>; private{" "}
        <code className="mono">spend_priv</code> stays in HSM, private{" "}
        <code className="mono">view_priv</code> goes to the indexer for
        scanning.
      </p>

      <CodeBlock>
        {`Domain separators (UTF-8 bytes):
  DOMAIN_SHARED   = "g-pay/stealth/shared/v1"
  DOMAIN_OFFSET   = "g-pay/stealth/offset/v1"
  DOMAIN_VIEW_TAG = "g-pay/stealth/view-tag/v1"

Sender (per payment):
  r          = Scalar::from_bytes_mod_order_wide(random 64 bytes)
  R          = r · G                                       // ephemeral_r
  shared     = sha512(DOMAIN_SHARED || (r · view_pub).compress())[..32]
  offset     = Scalar::from_bytes_mod_order_wide(
                 sha512(DOMAIN_OFFSET || shared || nonce_le8))
  P          = spend_pub + offset · G                      // stealth pubkey
  view_tag   = sha512(DOMAIN_VIEW_TAG || shared)[0]        // 1-byte prefilter

Recipient (per chain account observed):
  shared'    = sha512(DOMAIN_SHARED || (view_priv · R).compress())[..32]
  if sha512(DOMAIN_VIEW_TAG || shared')[0] != on-chain view_tag: skip
  derive(spend_pub, shared', nonce); compare with on-chain stealth_pubkey
  spend scalar = (spend_priv + offset) mod L`}
      </CodeBlock>

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Cross-language test vector
      </h3>
      <p className="text-sm leading-7">
        The exact same algorithm is implemented twice — the Rust crate{" "}
        <code className="mono">stealth-core</code> (used by the indexer and on-chain
        derivation) and the TypeScript port at{" "}
        <code className="mono">apps/api-gateway/src/stealth.ts</code> (used to
        generate addresses on the API side). Both must agree byte-exact on the
        following vector, locked in unit tests:
      </p>
      <CodeBlock>
        {`spend_priv     = 0102030405060708090a0b0c0d0e0f10
                 1112131415161718191a1b1c1d1e1f00
view_priv      = a0a1a2a3a4a5a6a7a8a9aaabacadaeaf
                 b0b1b2b3b4b5b6b7b8b9babbbcbdbe00
r_seed (64B)   = 21 22 … 60     (sequential bytes)
nonce          = 7

⇒  spend_pub      = 616e237719716e25ead63d831f9117f7
                    9b5aa05af8be30ff0eddb3dc43e8bdcf
   view_pub       = 3e97bbe3dad77cdbab3b9d7a5af96386
                    8b2ee668470874b566dad4a32076c98b
   stealth_pubkey = 20fa85036bcc5661f62af10c241ee824
                    3e2543735e7e869c58df13b02f3c26c3
   ephemeral_r    = 21c24081dfbed643c24ca431092386e1
                    cb0830937d5b4f4cc0d6f366586338b0
   view_tag       = 0xbf`}
      </CodeBlock>

      <p className="text-sm leading-7">
        See{" "}
        <ExternalLink href="https://github.com/nzengi/g-pay/blob/main/crates/stealth-core/tests/vectors.rs">
          crates/stealth-core/tests/vectors.rs
        </ExternalLink>{" "}
        and{" "}
        <ExternalLink href="https://github.com/nzengi/g-pay/blob/main/apps/api-gateway/tests/vector.test.ts">
          apps/api-gateway/tests/vector.test.ts
        </ExternalLink>
        . If you change the algorithm, update both sides simultaneously and
        relock the vector.
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function IndexerRelayer() {
  return (
    <section id="pipeline" className="space-y-4 scroll-mt-20">
      <SectionHeading>Indexer & relayer</SectionHeading>
      <p className="text-sm leading-7">
        Two Rust services round out the server stack. Both run inside Docker
        and have <em>no</em> public-facing endpoints (Caddy blocks{" "}
        <code className="mono">/v1/internal/*</code>; the relayer&apos;s HTTP
        port is internal-only).
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 text-sm space-y-2">
          <div className="font-semibold">indexer</div>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Polls{" "}
            <code className="mono">getProgramAccounts</code> every{" "}
            <code className="mono">GPAY_SCAN_INTERVAL_MS</code> (default 5s),
            filters by Deposit account size, scans each candidate against the
            registered slice&apos;s <code className="mono">view_priv</code>{" "}
            using <code className="mono">stealth-core</code>, and POSTs matches
            to the gateway&apos;s{" "}
            <code className="mono">/v1/internal/deposit-detected</code> webhook
            (HMAC&apos;d by{" "}
            <code className="mono">GPAY_INTERNAL_SECRET</code>).
          </p>
          <ExternalLink href="https://github.com/nzengi/g-pay/tree/main/crates/indexer">
            crates/indexer ↗
          </ExternalLink>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 text-sm space-y-2">
          <div className="font-semibold">relayer</div>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Axum HTTP service that accepts a base64-encoded{" "}
            <code className="mono">VersionedTransaction</code>, runs
            per-institution admission (token-bucket rate limit + monthly USDC
            cap + suspension), cosigns as fee payer, and submits to RPC.
            Designed so customers never need to hold SOL for fees.
          </p>
          <ExternalLink href="https://github.com/nzengi/g-pay/tree/main/crates/relayer">
            crates/relayer ↗
          </ExternalLink>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Security() {
  return (
    <section id="security" className="space-y-4 scroll-mt-20">
      <SectionHeading>Security & limitations</SectionHeading>

      <Callout tone="danger">
        Pre-audit. Devnet only. Do not move real value. The Anchor program has
        not had a third-party security review.
      </Callout>

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Demo institution caveat
      </h3>
      <p className="text-sm leading-7">
        The bundled demo uses{" "}
        <strong>publicly documented test vectors</strong> for the institution
        keys (<code className="mono">spend_priv = 0102…1f00</code>,{" "}
        <code className="mono">view_priv = a0a1…be00</code>). A real institution
        generates its own keys inside an HSM; only the public parts (
        <code className="mono">spend_pub</code>,{" "}
        <code className="mono">view_pub</code>) live in the gateway&apos;s
        institutions table.
      </p>

      <h3 className="text-base font-semibold tracking-tight pt-2">
        In scope for the cryptography
      </h3>
      <ul className="list-disc list-inside text-sm space-y-1 text-[var(--muted)]">
        <li>
          The Ed25519/Curve25519 derivation in{" "}
          <code className="mono">crates/stealth-core</code> and its TS port.
        </li>
        <li>
          The Anchor instruction set at{" "}
          <code className="mono">programs/quarantine-vault</code>.
        </li>
        <li>
          Cross-language vector agreement — any deviation between Rust and TS
          is treated as a security issue.
        </li>
      </ul>

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Known gaps (PRs welcome)
      </h3>
      <ul className="list-disc list-inside text-sm space-y-1 text-[var(--muted)]">
        <li>
          AML oracle is a stub. Real Chainalysis / TRM / Range adapter is the
          next step.
        </li>
        <li>
          View key lives on disk in <code className="mono">config/slices.json</code>{" "}
          for dev. Production must back this with KMS/HSM.
        </li>
        <li>
          Relayer keypair is loaded from a JSON file. Production should use a
          remote signer.
        </li>
        <li>
          Dashboard stores the institution API key in{" "}
          <code className="mono">localStorage</code>. Real customer onboarding
          needs a proper auth flow (SSO / mTLS / signed requests).
        </li>
        <li>
          The IP-only deployment uses HTTP; pointing a domain enables Caddy
          auto-TLS — do that before any external exposure.
        </li>
      </ul>

      <p className="text-sm leading-7">
        Full disclosure policy:{" "}
        <ExternalLink href="https://github.com/nzengi/g-pay/blob/main/SECURITY.md">
          SECURITY.md
        </ExternalLink>
        .
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Resources() {
  const links: [string, string][] = [
    ["DESIGN.md — full architecture & threat model", "https://github.com/nzengi/g-pay/blob/main/docs/DESIGN.md"],
    ["RUNBOOK.md — local stack + e2e demo", "https://github.com/nzengi/g-pay/blob/main/docs/RUNBOOK.md"],
    ["DEPLOY.md — server deployment plan", "https://github.com/nzengi/g-pay/blob/main/docs/DEPLOY.md"],
    ["VERCEL.md — dashboard deployment", "https://github.com/nzengi/g-pay/blob/main/docs/VERCEL.md"],
    ["SECURITY.md — disclosure policy", "https://github.com/nzengi/g-pay/blob/main/SECURITY.md"],
    ["CONTRIBUTING.md — PR checklist", "https://github.com/nzengi/g-pay/blob/main/CONTRIBUTING.md"],
  ];
  return (
    <section id="resources" className="space-y-4 scroll-mt-20">
      <SectionHeading>Resources</SectionHeading>
      <ul className="space-y-2 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <ExternalLink href={href}>{label} ↗</ExternalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Building blocks                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-semibold tracking-tight">{children}</h2>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "info" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--accent)";
  return (
    <div
      className="text-sm rounded-md border px-4 py-3"
      style={{
        borderColor: `${color}66`,
        background: `${color}11`,
        color,
      }}
    >
      <div className="text-[var(--foreground)]">{children}</div>
    </div>
  );
}

function CodeBlock({
  children,
  language,
}: {
  children: React.ReactNode;
  language?: string;
}) {
  return (
    <div className="relative">
      {language && (
        <div className="absolute right-3 top-2 text-[10px] uppercase tracking-wider text-[var(--muted)]">
          {language}
        </div>
      )}
      <pre className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto leading-6 mono">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function MethodChip({ method }: { method: string }) {
  const color =
    method === "GET"
      ? "var(--success)"
      : method === "POST"
        ? "var(--accent)"
        : method === "DELETE"
          ? "var(--danger)"
          : "var(--muted)";
  return (
    <span
      className="px-2 h-6 inline-flex items-center rounded text-[10px] font-semibold tracking-wider mono"
      style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
    >
      {method}
    </span>
  );
}

function DemoBadge() {
  return (
    <span className="ml-3 align-middle text-[10px] uppercase tracking-wider px-2 h-5 inline-flex items-center rounded-full bg-[var(--warn)] bg-opacity-10 text-[var(--warn)] border border-[var(--warn)]">
      devnet only
    </span>
  );
}

function Endpoint({
  method,
  path,
  summary,
  body,
  response,
  curl,
  demo,
}: {
  method: string;
  path: string;
  summary: string;
  body?: string;
  response: string;
  curl: string;
  demo?: boolean;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        <MethodChip method={method} />
        <code className="mono text-sm font-medium break-all">{path}</code>
        {demo && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--warn)]">
            devnet
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--muted)] leading-6">{summary}</p>
      {body && (
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Request body
          </div>
          <CodeBlock>{body}</CodeBlock>
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Response
        </div>
        <CodeBlock>{response}</CodeBlock>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1.5">
          curl
        </div>
        <CodeBlock language="bash">{curl}</CodeBlock>
      </div>
    </div>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-2)]">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="text-left px-4 py-2 text-xs uppercase tracking-wider text-[var(--muted)] font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-t border-[var(--border)] align-top"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3">
                  {typeof cell === "string" && j === 0 ? (
                    <code className="mono text-xs">{cell}</code>
                  ) : typeof cell === "string" && j < 2 ? (
                    <code className="mono text-xs text-[var(--muted)]">
                      {cell}
                    </code>
                  ) : (
                    <span className="text-xs leading-5">{cell}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountSchema({
  name,
  fields,
}: {
  name: string;
  fields: [string, string, string?][];
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-x-auto">
      <div className="px-4 py-2 text-sm font-semibold mono">{name}</div>
      <table className="w-full text-sm">
        <tbody>
          {fields.map(([f, t, n], i) => (
            <tr key={i} className="border-t border-[var(--border)]">
              <td className="px-4 py-2 mono text-xs whitespace-nowrap">{f}</td>
              <td className="px-4 py-2 mono text-xs text-[var(--muted)] whitespace-nowrap">
                {t}
              </td>
              <td className="px-4 py-2 text-xs leading-5">{n ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExternalLink({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "button";
}) {
  const cls =
    variant === "button"
      ? "h-10 px-4 inline-flex items-center rounded-md border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition-colors"
      : "text-[var(--accent)] underline-offset-2 hover:underline";
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  );
}
