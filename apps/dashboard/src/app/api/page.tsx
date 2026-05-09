import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "../../components/PublicHeader";

export const metadata: Metadata = {
  title: "g-pay · API reference",
  description:
    "REST endpoints, on-chain Anchor program reference, and stealth-address derivation spec for the live g-pay deployment on Solana devnet.",
};

const PROGRAM_ID = "75HuPfb2n7SD7KtcQnVpCW5SVN3RP9gZ9vTXP4D4ha6C";
const API_BASE = "https://g-pay-dashboard.vercel.app/api";
const DEMO_KEY = "demo-key-please-rotate";

export default function ApiPage() {
  return (
    <div className="min-h-full">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <Toc />
        <main className="min-w-0 space-y-16">
          <Hero />
          <BaseUrlAuth />
          <RestApi />
          <DemoApi />
          <OnChain />
          <StealthMath />
          <PipelineNotes />
          <Errors />
        </main>
      </div>
      <Footer />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Toc() {
  const items: [string, string][] = [
    ["overview", "Overview"],
    ["base", "Base URL & auth"],
    ["rest", "REST endpoints"],
    ["demo", "Demo endpoints"],
    ["onchain", "Anchor program"],
    ["stealth", "Stealth-address math"],
    ["pipeline", "Indexer & relayer"],
    ["errors", "Errors"],
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
        <div className="mt-6 pt-6 border-t border-[var(--border)] text-xs">
          <Link
            href="/docs"
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← Project docs
          </Link>
        </div>
      </nav>
    </aside>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-16 px-6 py-6 text-xs text-[var(--muted)]">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>
          Solana devnet · Anchor program{" "}
          <ExternalLink
            href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
          >
            {PROGRAM_ID.slice(0, 10)}…{PROGRAM_ID.slice(-6)}
          </ExternalLink>
        </div>
        <div>V1 · pre-audit · devnet only</div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section id="overview" className="space-y-5 scroll-mt-20">
      <div className="inline-flex items-center gap-2 px-3 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
        Live on Solana devnet
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        API reference
      </h1>
      <p className="text-base text-[var(--muted)] max-w-2xl leading-7">
        Everything you can call against the live deployment. REST endpoints,
        on-chain Anchor program, the stealth-address algorithm, and the locked
        cross-language test vector. For the project narrative see{" "}
        <Link href="/docs" className="text-[var(--accent)] hover:underline">
          /docs
        </Link>
        .
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function BaseUrlAuth() {
  return (
    <section id="base" className="space-y-4 scroll-mt-20">
      <SectionHeading>Base URL & auth</SectionHeading>
      <KvTable
        rows={[
          ["Public base URL", <code key="b" className="mono">{API_BASE}</code>],
          [
            "Auth header",
            <code key="a" className="mono">
              X-API-Key: &lt;institution key&gt;
            </code>,
          ],
          [
            "Demo key",
            <code key="d" className="mono">
              {DEMO_KEY}
            </code>,
          ],
          [
            "Content-Type for POST",
            <code key="c" className="mono">
              application/json
            </code>,
          ],
        ]}
      />
      <Callout tone="info">
        The public URL is a Vercel rewrite that proxies{" "}
        <code className="mono">/api/*</code> to the gateway running at the
        server&apos;s IP over HTTP. This keeps the browser on HTTPS and avoids
        mixed-content blocks. If you bypass Vercel, the gateway also serves the
        same routes directly at <code className="mono">http://***REDACTED***</code>.
      </Callout>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function RestApi() {
  return (
    <section id="rest" className="space-y-6 scroll-mt-20">
      <SectionHeading>REST endpoints</SectionHeading>
      <p className="text-sm text-[var(--muted)]">
        Six public endpoints, all behind <code className="mono">X-API-Key</code> auth.
      </p>

      <Endpoint
        method="POST"
        path="/v1/receiving-address"
        summary="Generate a fresh stealth address for one payment. Records the deposit in Postgres at state pending."
        body={`{
  "customer_id": "C-1234",
  "amount_hint": "100000000",        // string of digits, smallest units
  "mint": "USDC",                    // metadata only in V1; SOL deposits use the demo flow
  "expire_seconds": 3600,            // 60 .. 2592000
  "refund_addr_hex": "00".repeat(32) // 32-byte hex
}`}
        response={`{
  "deposit_id": "dep_xxxx",
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
        summary="Read a single deposit. on_chain_* fields are populated once the indexer has matched the on-chain Deposit account."
        response={`{
  "deposit_id": "dep_xxxx",
  "state": "pending" | "approved" | "rejected" | "released" | "refunded" | "expired",
  "amount_hint": "100000000",
  "stealth_pubkey_hex": "a09243…",
  "view_tag": 115,
  "expires_at": 1778342668574,
  "on_chain_address": "CrKu5EYNCT9c…" | null,
  "on_chain_amount":  "100000000"      | null,
  "on_chain_state":   "pending"        | null
}`}
        curl={`curl "${API_BASE}/v1/payment-status/dep_xxxx" \\
  -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="GET"
        path="/v1/treasury/deposits"
        summary="Aggregate counts by state for the calling institution."
        response={`{
  "total": 3,
  "by_state": { "pending": 1, "released": 2 }
}`}
        curl={`curl "${API_BASE}/v1/treasury/deposits" \\
  -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="GET"
        path="/v1/treasury/deposits/list?limit=N"
        summary="Paginated list of full deposit records, newest first. Default limit 100, max 500."
        response={`{
  "total": 1,
  "items": [
    {
      "deposit_id": "dep_xxxx",
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
        curl={`curl "${API_BASE}/v1/treasury/deposits/list?limit=20" \\
  -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="POST"
        path="/v1/release"
        summary="Mark an Approved deposit as released in the gateway DB. Does NOT submit the on-chain release tx — pair with the demo endpoint or your own signer in V2."
        body={`{
  "deposit_id": "dep_xxxx",
  "target_addr_hex": "cd".repeat(32)
}`}
        response={`{
  "deposit_id": "dep_xxxx",
  "state": "released",
  "target_addr_hex": "cdcd…",
  "note": "gateway tracks release; on-chain submission goes via gpay-cli or relayer"
}`}
        curl={`curl -X POST "${API_BASE}/v1/release" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxxx","target_addr_hex":"${"cd".repeat(32)}"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/refund"
        summary="Mark a Rejected/Expired deposit as refunded in the gateway DB."
        body={`{ "deposit_id": "dep_xxxx" }`}
        response={`{
  "deposit_id": "dep_xxxx",
  "state": "refunded",
  "refund_addr_hex": "00…"
}`}
        curl={`curl -X POST "${API_BASE}/v1/refund" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxxx"}'`}
      />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function DemoApi() {
  return (
    <section id="demo" className="space-y-6 scroll-mt-20">
      <SectionHeading>
        Demo endpoints <DemoBadge />
      </SectionHeading>
      <p className="text-sm leading-7">
        These endpoints execute real Solana devnet transactions on the
        operator&apos;s behalf using server-side keypairs (the demo wallet,
        two oracle signers). They exist so a hackathon judge can verify the
        full lifecycle without holding any keys, and they are scoped to the
        bundled demo institution only. <em>In V2 they go away in favor of
        institution-side signing + outbound webhooks.</em>
      </p>

      <Endpoint
        method="POST"
        path="/v1/demo/init"
        demo
        summary="Create a deposit record with judge-friendly defaults: 0.1 SOL, refund_addr pre-wired to the on-server demo wallet, 1-hour expiry."
        response={`{
  "deposit_id": "dep_xxxx",
  "stealth_pubkey_hex": "3d0a10…",
  "ephemeral_r_hex":    "048c87…",
  "view_tag": 92,
  "refund_pubkey": "E5sMsf…",
  "expires_at": 1778343825242
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/init" \\
  -H "x-api-key: ${DEMO_KEY}"`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/simulate-payment"
        demo
        summary="Submit a real on-chain SOL deposit to the deposit's stealth address. The indexer picks it up within ~5s and webhooks the gateway."
        body={`{ "deposit_id": "dep_xxxx" }`}
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
  -d '{"deposit_id":"dep_xxxx"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/attest"
        demo
        summary="Two oracles sign an attestation with the given verdict. Threshold (2-of-3) is reached in one call so the on-chain state moves immediately."
        body={`{
  "deposit_id": "dep_xxxx",
  "verdict": "clean" | "dirty"
}`}
        response={`{
  "stage": "attest",
  "verdict": "clean",
  "signatures":   ["2HUEki…", "2KR9sW…"],
  "explorer_txs": ["https://…", "https://…"]
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/attest" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxxx","verdict":"clean"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/release"
        demo
        summary="Submit the on-chain release for an Approved deposit. Generates a fresh target pubkey on the server and moves the lamports there."
        body={`{ "deposit_id": "dep_xxxx" }`}
        response={`{
  "stage": "release",
  "signature": "61guN7…",
  "target": "6vGTSK…",
  "explorer_tx":     "https://…",
  "explorer_target": "https://explorer.solana.com/address/6vGTSK…?cluster=devnet"
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/release" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxxx"}'`}
      />

      <Endpoint
        method="POST"
        path="/v1/demo/refund"
        demo
        summary="Submit the on-chain refund for a Rejected/Expired deposit. Sends to the captured refund_addr."
        body={`{ "deposit_id": "dep_xxxx" }`}
        response={`{
  "stage": "refund",
  "signature": "...",
  "refund_target": "E5sMsf…",
  "explorer_tx": "https://…"
}`}
        curl={`curl -X POST "${API_BASE}/v1/demo/refund" \\
  -H "x-api-key: ${DEMO_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"deposit_id":"dep_xxxx"}'`}
      />
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function OnChain() {
  return (
    <section id="onchain" className="space-y-6 scroll-mt-20">
      <SectionHeading>Anchor program</SectionHeading>
      <KvTable
        rows={[
          [
            "Program ID",
            <ExternalLink
              key="p"
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
            >
              <span className="mono">{PROGRAM_ID}</span> ↗
            </ExternalLink>,
          ],
          [
            "Source",
            <ExternalLink
              key="s"
              href="https://github.com/nzengi/g-pay/tree/main/programs/quarantine-vault"
            >
              programs/quarantine-vault
            </ExternalLink>,
          ],
          ["Cluster", "devnet"],
          ["Anchor", "1.0.x · SBF target · LiteSVM tests"],
        ]}
      />

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Instructions (8)
      </h3>
      <Table
        head={["Name", "Signs", "Effect"]}
        rows={[
          [
            "initialize_vault",
            "authority",
            "Creates the Vault PDA. Stores oracle_set + min_attestations.",
          ],
          [
            "deposit",
            "depositor",
            "Locks SOL in a per-deposit PDA. State = Pending. PDA seed: ['deposit', vault, stealth_pubkey, ephemeral_r].",
          ],
          [
            "deposit_token",
            "depositor",
            "SPL Token / Token-2022 variant. Tokens go to a per-deposit escrow_token_account whose authority is the Deposit PDA.",
          ],
          [
            "attest",
            "oracle ∈ oracle_set",
            "Records one Attestation. clean_count ≥ threshold → Approved; dirty_count ≥ threshold → Rejected.",
          ],
          [
            "release",
            "deposit.release_authority",
            "Approved → Released. Lamports move to a target pubkey.",
          ],
          [
            "release_token",
            "deposit.release_authority",
            "SPL variant. token::transfer_checked from escrow → target token account.",
          ],
          [
            "refund",
            "any caller",
            "Rejected | Expired | (Pending past expire_at) → Refunded. Sends to deposit.refund_addr.",
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
            ["oracle_set", "Vec<Pubkey>", "max_len 16"],
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
            ["ephemeral_r", "[u8; 32]", "sender's ephemeral pubkey R"],
            ["view_tag", "u8"],
            ["mint", "Pubkey", "Pubkey::default for SOL deposits"],
            ["amount", "u64"],
            ["depositor", "Pubkey"],
            ["refund_addr", "Pubkey"],
            ["release_authority", "Pubkey"],
            ["created_at", "i64"],
            ["expire_at", "i64"],
            ["state", "DepositState"],
            ["attestations", "Vec<Attestation>", "max_len 16"],
            ["clean_count", "u8"],
            ["dirty_count", "u8"],
          ]}
        />
      </div>

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Enums & PDA seeds
      </h3>
      <CodeBlock>
        {`DepositState  = Pending | Approved | Rejected | Released | Refunded | Expired
AmlVerdict    = Clean   | Dirty

vault           seeds = ["vault",   authority]
deposit         seeds = ["deposit", vault, stealth_pubkey, ephemeral_r]
escrow_token    seeds = ["escrow_token", deposit]   // only for SPL deposits`}
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
        Cryptonote-style two-key scheme on Curve25519. The institution
        publishes <code className="mono">spend_pub</code> and{" "}
        <code className="mono">view_pub</code>; private{" "}
        <code className="mono">spend_priv</code> stays in HSM (V2),{" "}
        <code className="mono">view_priv</code> goes to the indexer for
        scanning.
      </p>

      <CodeBlock>
        {`Domain separators (UTF-8 bytes):
  DOMAIN_SHARED   = "g-pay/stealth/shared/v1"
  DOMAIN_OFFSET   = "g-pay/stealth/offset/v1"
  DOMAIN_VIEW_TAG = "g-pay/stealth/view-tag/v1"

Sender (per payment, gateway computes this for the customer):
  r          = Scalar::from_bytes_mod_order_wide(random 64 bytes)
  R          = r · G                                       // ephemeral_r
  shared     = sha512(DOMAIN_SHARED || (r · view_pub).compress())[..32]
  offset     = Scalar::from_bytes_mod_order_wide(
                 sha512(DOMAIN_OFFSET || shared || nonce_le8))
  P          = spend_pub + offset · G                      // stealth pubkey
  view_tag   = sha512(DOMAIN_VIEW_TAG || shared)[0]        // 1-byte tag

Recipient (indexer scans every observed Deposit account):
  shared'    = sha512(DOMAIN_SHARED || (view_priv · R).compress())[..32]
  if sha512(DOMAIN_VIEW_TAG || shared')[0] != on-chain view_tag: skip
  P'         = spend_pub + scalar_from_hash(DOMAIN_OFFSET || shared' || nonce) · G
  match      = (P' == on-chain stealth_pubkey)

Spend (only the spend_priv holder can do this):
  spend scalar = (spend_priv + offset) mod L`}
      </CodeBlock>

      <Callout tone="info">
        The view-tag is computed from the same{" "}
        <code className="mono">shared</code> value as the rest of the
        derivation, so it doesn&apos;t skip the scalar multiplication. What it
        does skip is the second derivation step (recomputing{" "}
        <code className="mono">P&apos;</code> with point addition) when the tag
        doesn&apos;t match — roughly halving the work for non-matching
        deposits.
      </Callout>

      <h3 className="text-base font-semibold tracking-tight pt-2">
        Cross-language test vector
      </h3>
      <p className="text-sm leading-7">
        Implemented twice and locked byte-exact across Rust and TypeScript:
      </p>
      <CodeBlock>
        {`spend_priv     = 0102030405060708090a0b0c0d0e0f10
                 1112131415161718191a1b1c1d1e1f00
view_priv      = a0a1a2a3a4a5a6a7a8a9aaabacadaeaf
                 b0b1b2b3b4b5b6b7b8b9babbbcbdbe00
r_seed (64B)   = 21 22 … 60      (sequential bytes)
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
        Sources:{" "}
        <ExternalLink href="https://github.com/nzengi/g-pay/blob/main/crates/stealth-core/tests/vectors.rs">
          crates/stealth-core/tests/vectors.rs
        </ExternalLink>{" "}
        ·{" "}
        <ExternalLink href="https://github.com/nzengi/g-pay/blob/main/apps/api-gateway/tests/vector.test.ts">
          apps/api-gateway/tests/vector.test.ts
        </ExternalLink>
        . Any algorithm change must update both sides at once and relock the
        vector.
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function PipelineNotes() {
  return (
    <section id="pipeline" className="space-y-4 scroll-mt-20">
      <SectionHeading>Indexer & relayer</SectionHeading>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">indexer</span>
            <Tag tone="success">In production loop</Tag>
          </div>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Long-running Rust binary inside the docker compose stack. Polls{" "}
            <code className="mono">getProgramAccounts</code> every{" "}
            <code className="mono">GPAY_SCAN_INTERVAL_MS</code> (default 5s),
            filters by Deposit account size, scans each candidate against the
            registered slice&apos;s <code className="mono">view_priv</code>{" "}
            using <code className="mono">stealth-core</code>, and POSTs matches
            to the gateway&apos;s internal{" "}
            <code className="mono">/v1/internal/deposit-detected</code>{" "}
            endpoint authenticated by{" "}
            <code className="mono">GPAY_INTERNAL_SECRET</code>. The internal
            route is blocked from the public internet by Caddy.
          </p>
          <ExternalLink href="https://github.com/nzengi/g-pay/tree/main/crates/indexer">
            crates/indexer ↗
          </ExternalLink>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">relayer</span>
            <Tag tone="warn">Dormant in V1</Tag>
          </div>
          <p className="text-xs leading-5 text-[var(--muted)]">
            Axum HTTP service inside the same stack. Exposes{" "}
            <code className="mono">/v1/submit</code> which decodes a
            base64-encoded <code className="mono">VersionedTransaction</code>,
            runs per-institution admission (token-bucket rate limit + monthly
            USDC fee cap + suspension), cosigns as fee payer, and submits to
            RPC. <strong>The V1 demo flow does not use it</strong> — the demo
            wallet pays its own fees via{" "}
            <code className="mono">gpay-cli</code>. V2 routes every customer
            and release transaction through the relayer so customers don&apos;t
            need SOL.
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

function Errors() {
  return (
    <section id="errors" className="space-y-4 scroll-mt-20">
      <SectionHeading>Errors</SectionHeading>
      <p className="text-sm leading-7">
        All non-2xx responses are JSON{" "}
        <code className="mono">{`{ error: string, detail?: any }`}</code>.
      </p>
      <Table
        head={["Status", "When", "Body"]}
        rows={[
          [
            "400",
            "Zod validation rejected the body. detail is the Zod error path.",
            '{ "error": "invalid_body", "detail": { … } }',
          ],
          [
            "401",
            "Missing or unknown X-API-Key.",
            '{ "error": "missing X-API-Key header" } | { "error": "invalid api key" }',
          ],
          [
            "403",
            "Internal endpoint hit without GPAY_INTERNAL_SECRET (only reachable from inside the docker network anyway).",
            '{ "error": "forbidden" }',
          ],
          [
            "404",
            "Deposit lookup missed (also returned for cross-institution lookups).",
            '{ "error": "not_found" }',
          ],
          [
            "409",
            "State machine refused the action (release before approval, refund of an unrefundable state, etc.).",
            '{ "error": "not_approved", "state": "pending" }',
          ],
          [
            "500",
            "Demo endpoint shell-out failed (CLI exit code != 0). detail carries the captured stderr.",
            '{ "stage": "release", "error": "…" }',
          ],
        ]}
      />
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
      style={{ borderColor: `${color}66`, background: `${color}11` }}
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
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}66`,
      }}
    >
      {method}
    </span>
  );
}

function DemoBadge() {
  return (
    <span className="ml-3 align-middle text-[10px] uppercase tracking-wider px-2 h-5 inline-flex items-center rounded-full bg-[var(--warn)] text-[var(--warn)] border border-[var(--warn)]">
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
            <tr key={i} className="border-t border-[var(--border)] align-top">
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

function KvTable({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-0">
              <td className="px-4 py-2 text-xs uppercase tracking-wider text-[var(--muted)] w-44">
                {k}
              </td>
              <td className="px-4 py-2 text-sm">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tag({
  tone,
  children,
}: {
  tone: "success" | "warn";
  children: React.ReactNode;
}) {
  const color = tone === "success" ? "var(--success)" : "var(--warn)";
  return (
    <span
      className="px-2 h-5 inline-flex items-center rounded text-[10px] font-semibold tracking-wider uppercase"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}66`,
      }}
    >
      {children}
    </span>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}
