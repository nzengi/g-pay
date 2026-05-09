import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "../../components/PublicHeader";

export const metadata: Metadata = {
  title: "g-pay · Docs",
  description:
    "Project guide: what g-pay V1 actually does on Solana devnet, the three primitives it composes, the end-to-end demo flow, and what changes in V2.",
};

const PROGRAM_ID = "75HuPfb2n7SD7KtcQnVpCW5SVN3RP9gZ9vTXP4D4ha6C";

export default function DocsPage() {
  return (
    <div className="min-h-full">
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        <Toc />
        <main className="min-w-0 space-y-16">
          <Hero />
          <Problem />
          <Primitives />
          <EndToEnd />
          <Status />
          <RepoStructure />
          <V2Hints />
          <Caveats />
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
    ["problem", "The problem"],
    ["primitives", "Three primitives"],
    ["flow", "End-to-end flow"],
    ["status", "What V1 ships"],
    ["repo", "Repo structure"],
    ["v2", "V2 roadmap"],
    ["caveats", "Caveats"],
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
            href="/api"
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            → API reference
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
        V1 live on Solana devnet
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        What g-pay is, what V1 does, and where V2 takes it.
      </h1>
      <p className="text-base text-[var(--muted)] max-w-2xl leading-7">
        g-pay is an institutional payments backend on Solana that protects the
        institution&apos;s on-chain identity by combining three classical
        primitives: per-payment stealth addresses, an AML-gated escrow program,
        and a no-consolidation treasury pattern. No zero-knowledge proofs.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/"
          className="h-10 px-4 inline-flex items-center rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90"
        >
          Try the live demo →
        </Link>
        <Link
          href="/api"
          className="h-10 px-4 inline-flex items-center rounded-md border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition-colors"
        >
          API reference
        </Link>
        <ExternalLink href="https://github.com/nzengi/g-pay" variant="button">
          GitHub ↗
        </ExternalLink>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section id="problem" className="space-y-4 scroll-mt-20">
      <SectionHeading>The problem</SectionHeading>
      <p className="text-sm leading-7">
        On a transparent chain like Solana, an institution&apos;s treasury
        address is a long-lived identity. If a customer pays from a wallet that
        is later added to a sanctions list, the institution&apos;s treasury is
        now linked, on-chain, to a sanctioned entity. Public ledger means
        public liability — and unlike private banking, you cannot &quot;not
        accept&quot; a transaction once it&apos;s on chain.
      </p>
      <p className="text-sm leading-7">
        The interesting risk is the <strong>address</strong>, not the amount.
        Existing Solana privacy work (Token-2022 confidential transfers,
        Confidential Balances) hides amounts but leaves addresses public. g-pay
        is the opposite: amounts stay public, addresses change every payment,
        and an attestation gate runs <em>before</em> any funds touch the
        institution&apos;s side.
      </p>
    </section>
  );
}

function Primitives() {
  return (
    <section id="primitives" className="space-y-6 scroll-mt-20">
      <SectionHeading>Three primitives</SectionHeading>
      <p className="text-sm leading-7">
        The whole stack is the composition of three things any Solana developer
        already understands. None of them require ZK.
      </p>

      <Primitive
        n={1}
        title="Per-payment stealth addresses (Curve25519)"
        v1="Cryptonote-style two-key derivation adapted for Curve25519. The institution publishes spend_pub and view_pub. For each payment, the gateway samples r, computes R = r·G, and derives the per-payment stealth pubkey P = spend_pub + H(r·view_pub)·G. Implemented twice — once in the Rust crate stealth-core (used by the indexer) and once in the TypeScript port at apps/api-gateway/src/stealth.ts (used by the gateway). Byte-exact equality is locked by a unit test in both languages."
        v2="V2 will combine address-level privacy with amount-level privacy by layering Token-2022 Confidential Balances on top, so the institution can also keep transfer amounts private from the public chain while the AML oracle still sees them."
      />

      <Primitive
        n={2}
        title="Quarantine vault (Anchor program)"
        v1="An Anchor program at programs/quarantine-vault holds incoming SOL or SPL tokens in a per-deposit escrow PDA at state Pending. The Vault account stores an oracle_set (max 16) and a min_attestations threshold. Each oracle in the set can post one Attestation per deposit; once clean_count or dirty_count reaches the threshold, state advances to Approved or Rejected. Released funds leave from the deposit PDA via an explicit release instruction; refunded funds go back to a refund_addr captured at deposit time."
        v2="V1 ships the m-of-n state machine, but the oracle set in the demo is just three keypairs that vote however the demo endpoint tells them to. V2 wires real adapters — Chainalysis, TRM Labs, Range — that produce signed attestations from external risk scores. We also add evidence_hash IPFS upload and a per-attestor dispute window."
      />

      <Primitive
        n={3}
        title='Hyperscaled treasury ("no consolidation")'
        v1="Each release in the demo flow goes to a freshly generated pubkey — there is no on-chain link between successive payments to the same institution. This is the Bitcoin UTXO best-practice (one address per receive) reapplied to Solana, where ATA rent (~0.002 SOL) makes per-payment accounts cheap. Note: V1 does not enforce uniqueness in the program; it's a discipline of the demo flow. The institution is free to re-use targets if it wants."
        v2="V2 will add a slice planner: an off-chain coin-selection layer that decides which slice receives each release based on an internal balance ledger, plus an aggregate balance UI in the dashboard so the institution can still feel like 'one wallet' while operating across thousands of slices on chain."
      />
    </section>
  );
}

function Primitive({
  n,
  title,
  v1,
  v2,
}: {
  n: number;
  title: string;
  v1: string;
  v2: string;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 shrink-0 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-semibold inline-flex items-center justify-center">
          {n}
        </span>
        <h3 className="text-base font-semibold tracking-tight pt-0.5">
          {title}
        </h3>
      </div>
      <div>
        <Tag tone="success">V1 ships</Tag>
        <p className="text-sm leading-6 mt-2">{v1}</p>
      </div>
      <div>
        <Tag tone="warn">V2 plans</Tag>
        <p className="text-sm leading-6 mt-2 text-[var(--muted)]">{v2}</p>
      </div>
    </div>
  );
}

function EndToEnd() {
  return (
    <section id="flow" className="space-y-4 scroll-mt-20">
      <SectionHeading>
        End-to-end flow (what actually happens when you click the buttons)
      </SectionHeading>
      <ol className="space-y-3 text-sm leading-6 list-decimal list-inside">
        <li>
          <strong>Initialize a deposit.</strong> The dashboard hits{" "}
          <code className="mono">POST /v1/demo/init</code>. The gateway derives
          a fresh stealth address (<code className="mono">P</code>,{" "}
          <code className="mono">R</code>,{" "}
          <code className="mono">view_tag</code>) using the demo
          institution&apos;s public keys, writes a row to Postgres with state{" "}
          <code className="mono">pending</code>, and pre-wires{" "}
          <code className="mono">refund_addr</code> to the on-server demo
          wallet.
        </li>
        <li>
          <strong>Customer payment.</strong> The dashboard&apos;s &quot;Simulate
          customer payment&quot; button calls{" "}
          <code className="mono">POST /v1/demo/simulate-payment</code>. The
          gateway shells out to the bundled{" "}
          <code className="mono">gpay-cli</code> binary, which submits a real
          Solana devnet transaction — the program&apos;s{" "}
          <code className="mono">deposit</code> instruction — that creates a
          new <code className="mono">Deposit</code> PDA holding 0.1 SOL.
        </li>
        <li>
          <strong>Indexer scan.</strong> Roughly every 5 seconds, the indexer
          (a separate Rust process) calls{" "}
          <code className="mono">getProgramAccounts</code> on the program,
          filtered by Deposit account size. For each candidate it computes the
          shared secret with the registered slice&apos;s view-private key, and
          if the derived pubkey matches the on-chain{" "}
          <code className="mono">stealth_pubkey</code>, it POSTs an internal
          webhook to the gateway. The gateway updates the deposit row with{" "}
          <code className="mono">on_chain_address</code> + amount.
        </li>
        <li>
          <strong>AML attestation.</strong> Two oracles sign{" "}
          <code className="mono">attest</code> instructions with verdict =
          clean (or dirty). On the second signature the threshold is reached
          and the on-chain deposit moves to{" "}
          <code className="mono">Approved</code> (or{" "}
          <code className="mono">Rejected</code>). The next indexer pass
          mirrors the new state into the gateway record.{" "}
          <em>
            In V1 the oracles are just keypairs that vote whatever the demo
            endpoint tells them; the attestation flow is real, the
            risk-scoring source is not.
          </em>
        </li>
        <li>
          <strong>Release.</strong> Approved deposits can be released. The
          dashboard&apos;s release button generates a fresh target pubkey on
          the server (a new treasury slice), then submits the program&apos;s{" "}
          <code className="mono">release</code> instruction signed by the
          deposit&apos;s recorded{" "}
          <code className="mono">release_authority</code>. Lamports move from
          the deposit PDA to the fresh slice. Indexer picks up the new state,
          gateway records <code className="mono">released</code>.
        </li>
        <li>
          <strong>Refund.</strong> Rejected or expired deposits can be refunded
          to the captured <code className="mono">refund_addr</code>. The
          program enforces that{" "}
          <code className="mono">refund_target == deposit.refund_addr</code>.
        </li>
      </ol>
      <Callout tone="info">
        Every transaction in the flow is a normal Solana devnet transaction
        with a public signature. Your dashboard records each one with a Solana
        Explorer link so you can verify them out-of-band.
      </Callout>
    </section>
  );
}

function Status() {
  return (
    <section id="status" className="space-y-4 scroll-mt-20">
      <SectionHeading>What V1 ships (and what it doesn&apos;t)</SectionHeading>
      <p className="text-sm leading-7 text-[var(--muted)]">
        Honest table — green is verified working, yellow is real but stubbed,
        gray is intentionally out-of-scope for V1.
      </p>
      <table className="w-full text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wider text-[var(--muted)]">
          <tr>
            <th className="text-left px-4 py-2">Component</th>
            <th className="text-left px-4 py-2">V1 status</th>
            <th className="text-left px-4 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              [
                "Anchor program",
                "ok",
                "8 instructions on devnet (initialize_vault, deposit/_token, attest, release/_token, refund/_token). LiteSVM tests cover the SOL paths end-to-end.",
              ],
              [
                "Stealth-address derivation",
                "ok",
                "Rust + TypeScript, byte-exact cross-language test vector locked in unit tests.",
              ],
              [
                "Indexer (devnet RPC scan)",
                "ok",
                "Polls getProgramAccounts every 5s, view-key match, posts to gateway internal webhook.",
              ],
              [
                "API gateway (REST + Postgres)",
                "ok",
                "6 public endpoints + 5 demo endpoints + 1 internal webhook, served behind a Caddy reverse proxy on the server.",
              ],
              [
                "Dashboard (Next.js on Vercel)",
                "ok",
                "Guided demo flow, deposit detail with stepper, Solana Explorer links per transaction.",
              ],
              [
                "AML oracle",
                "stub",
                "The m-of-n attestation flow is real on chain; the verdict source is just keypairs that vote whatever the demo endpoint says. No Chainalysis / TRM yet.",
              ],
              [
                "Relayer (fee-payer service)",
                "stub",
                "Service exists with rate limit + admission policy + cosign helper, but the demo flow currently bypasses it (the demo wallet pays its own fees).",
              ],
              [
                "Hyperscaled treasury aggregator",
                "stub",
                "The demo flow generates a fresh release target every time, but the program does not enforce uniqueness and there is no slice-balance aggregator UI yet.",
              ],
              [
                "Webhook delivery to institutions",
                "out",
                "Internal indexer→gateway webhook works; outbound institution callbacks are V2.",
              ],
              [
                "SPL deposits in the demo flow",
                "out",
                "The program supports Token + Token-2022 (deposit_token / release_token / refund_token), but the dashboard only drives the SOL path. CLI subcommand for SPL deposit is also V2.",
              ],
              [
                "Mainnet deployment",
                "out",
                "V1 is devnet-only on purpose. Mainnet requires audit + KMS-backed signers + real oracle integrations.",
              ],
            ] as [string, "ok" | "stub" | "out", string][]
          ).map(([c, s, n]) => (
            <tr key={c} className="border-t border-[var(--border)]">
              <td className="px-4 py-3 font-medium text-sm">{c}</td>
              <td className="px-4 py-3">
                <StatusPill kind={s} />
              </td>
              <td className="px-4 py-3 text-xs leading-5 text-[var(--muted)]">
                {n}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StatusPill({ kind }: { kind: "ok" | "stub" | "out" }) {
  const map = {
    ok: ["var(--success)", "Working"],
    stub: ["var(--warn)", "Stub"],
    out: ["var(--muted)", "V2 / out of scope"],
  } as const;
  const [color, label] = map[kind];
  return (
    <span
      className="px-2 h-6 inline-flex items-center rounded text-[10px] font-semibold tracking-wider"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}66`,
      }}
    >
      {label}
    </span>
  );
}

function RepoStructure() {
  return (
    <section id="repo" className="space-y-3 scroll-mt-20">
      <SectionHeading>Repo structure</SectionHeading>
      <p className="text-sm leading-7 text-[var(--muted)]">
        Each path below corresponds to a real piece of code on{" "}
        <ExternalLink href="https://github.com/nzengi/g-pay">
          GitHub
        </ExternalLink>
        .
      </p>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {(
              [
                [
                  "programs/quarantine-vault/",
                  "Anchor program (Rust, SBF). 8 instructions, 2 accounts.",
                ],
                [
                  "crates/stealth-core/",
                  "Curve25519 stealth-address derivation, scan, and spend-key reconstruction. The cross-language test vector lives here.",
                ],
                [
                  "crates/indexer/",
                  "Devnet RPC scanner. Long-running Rust binary that polls the program, view-key matches, posts to the gateway.",
                ],
                [
                  "crates/relayer/",
                  "Axum HTTP fee-payer service. V1 has the policy + cosign helper; not yet wired into the demo path.",
                ],
                [
                  "crates/cli/",
                  "Operator CLI. Used by the gateway demo endpoints to build + sign + submit the actual on-chain transactions.",
                ],
                [
                  "apps/api-gateway/",
                  "Hono + Node + Postgres REST API. 6 public endpoints + 5 demo endpoints + 1 internal webhook.",
                ],
                [
                  "apps/dashboard/",
                  "Next.js 16 + Tailwind frontend. Hosted on Vercel. /, /docs, /api, /deposits/* routes.",
                ],
                [
                  "deploy/",
                  "Docker compose stack (postgres + redis + caddy + 3 services), Postgres migrations, Caddyfile.",
                ],
                [
                  "scripts/",
                  "bootstrap-local.sh, deploy-program-devnet.sh, build-artifacts.sh, deploy-server.sh.",
                ],
              ] as [string, string][]
            ).map(([path, what]) => (
              <tr
                key={path}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-4 py-2 mono text-xs text-[var(--accent)] whitespace-nowrap align-top">
                  {path}
                </td>
                <td className="px-4 py-2 text-xs leading-5">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function V2Hints() {
  return (
    <section id="v2" className="space-y-4 scroll-mt-20">
      <SectionHeading>V2 roadmap</SectionHeading>
      <p className="text-sm leading-7 text-[var(--muted)]">
        Not promises — directions of work, ordered roughly by impact.
      </p>
      <ol className="space-y-3 text-sm leading-7 list-decimal list-inside">
        <li>
          <strong>Real AML oracle.</strong> Chainalysis + TRM Labs + Range
          adapters that turn external risk scores into on-chain attestations,
          with evidence-hash → IPFS upload and a per-attestor dispute window.
          The m-of-n primitive stays exactly the same; only the verdict source
          changes.
        </li>
        <li>
          <strong>Relayer in the loop.</strong> Today the demo flow signs and
          pays fees from a single demo wallet, so the relayer service is
          dormant. V2 routes every customer-side and release-side transaction
          through the relayer&apos;s{" "}
          <code className="mono">/v1/submit</code> endpoint so customers
          don&apos;t need SOL for fees and operators get a single billing
          surface.
        </li>
        <li>
          <strong>Confidential amounts on top.</strong> Compose stealth-address
          (address privacy) with Token-2022 Confidential Balances (amount
          privacy). The institution gets full transfer privacy from the public
          chain; auditor-key holders (the institution itself + regulator under
          court order) still see plaintext.
        </li>
        <li>
          <strong>Real institution signing.</strong> View key in HSM/KMS, no
          plaintext on disk anywhere. Release authority via remote signer
          (Ledger / Fireblocks / Squads multisig). API key replaced by signed
          requests + mTLS.
        </li>
        <li>
          <strong>Outbound webhooks + retry queue.</strong> When a deposit
          changes state, the gateway POSTs to an institution-supplied URL with
          HMAC and an idempotency key, retries with exponential backoff, and
          surfaces failures in the dashboard.
        </li>
        <li>
          <strong>SPL deposit demo path.</strong> The program already supports{" "}
          <code className="mono">deposit_token</code> /{" "}
          <code className="mono">release_token</code> /{" "}
          <code className="mono">refund_token</code>. V2 adds the matching
          gpay-cli subcommands and a dashboard token selector so judges can
          test USDC alongside SOL.
        </li>
        <li>
          <strong>Sub-second detection.</strong> Replace the indexer&apos;s 5s
          polling with <code className="mono">programSubscribe</code> over
          WebSocket. Same match logic, lower latency, fewer RPC calls.
        </li>
        <li>
          <strong>Slice planner.</strong> Off-chain coin-selection layer that
          chooses release targets based on an internal balance ledger, plus an
          aggregated balance UI so the institution feels like &quot;one
          wallet&quot; while operating across many slices.
        </li>
        <li>
          <strong>Domain + TLS.</strong> Point a domain at the server, switch
          Caddy to <code className="mono">your-domain.com</code> for automatic
          Let&apos;s Encrypt. Until then the dashboard hits the gateway via a
          Vercel rewrite to bypass mixed-content blocks.
        </li>
        <li>
          <strong>Audit + mainnet.</strong> Third-party security review
          (OtterSec / Sec3 / Neodyme) covering the program + the indexer
          webhook auth + the relayer admission flow, before any mainnet write.
        </li>
      </ol>
    </section>
  );
}

function Caveats() {
  return (
    <section id="caveats" className="space-y-4 scroll-mt-20">
      <SectionHeading>Caveats</SectionHeading>
      <Callout tone="danger">
        V1 is pre-audit, devnet only. Do not move real value through it.
      </Callout>
      <ul className="list-disc list-inside text-sm space-y-2 leading-6">
        <li>
          <strong>Demo institution test vectors.</strong> The bundled demo uses
          publicly documented private keys for the institution
          (<code className="mono">spend_priv = 0102…1f00</code>,{" "}
          <code className="mono">view_priv = a0a1…be00</code>). They live in{" "}
          <code className="mono">crates/stealth-core/tests/vectors.rs</code> on
          purpose, so the cross-language test can lock byte-exact derivation.
          Real institutions generate their keys inside an HSM and the gateway
          only ever sees the public parts.
        </li>
        <li>
          <strong>Demo wallet on disk.</strong> The on-server keypair that
          plays the customer + release authority in the demo flow is funded
          with devnet SOL only. Its private key sits at{" "}
          <code className="mono">config/demo-wallet.json</code> on the server
          and is <strong>not in the public repo</strong> (.gitignore covers
          it).
        </li>
        <li>
          <strong>Oracle keys on disk.</strong> Same story for the three oracle
          keypairs. Real production oracles would each be operated by separate
          institutions / risk vendors with their own signing infrastructure.
        </li>
        <li>
          <strong>HTTP only.</strong> The server is exposed on its IP over
          plain HTTP. The dashboard reaches it through a Vercel rewrite (HTTPS
          to HTTPS, then Vercel proxies HTTP server-side) — that side-steps
          mixed-content for now but is not a substitute for a domain + TLS.
        </li>
        <li>
          See{" "}
          <ExternalLink href="https://github.com/nzengi/g-pay/blob/main/SECURITY.md">
            SECURITY.md
          </ExternalLink>{" "}
          for the disclosure policy and the full known-gaps list.
        </li>
      </ul>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-semibold tracking-tight">{children}</h2>
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
      }}
    >
      <div className="text-[var(--foreground)]">{children}</div>
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
