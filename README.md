# g-pay

> Stealth-address payment privacy for institutions on Solana — without ZK.

g-pay is an API and runtime stack that lets a bank, exchange, or payment
processor on Solana **never expose its treasury wallet on chain**. Each
incoming payment lands at a freshly derived stealth address; an AML oracle
attests the funds are clean; only then can the recipient release them to a
fresh slice of a hyperscaled treasury.

The combination of three Solana-native primitives — **Ed25519 stealth
addresses**, an **AML-gated quarantine vault** Anchor program, and a
**hyperscaled (no-consolidation) treasury** — gives address-level privacy with
full auditability, without any zero-knowledge dependency.

> ⚠️ **Status: experimental, devnet only, unaudited.** Do not move real value
> through this. The Anchor program has not undergone a third-party audit; the
> AML oracle is a stub; the relayer holds keypairs in plaintext for local
> dev. See [SECURITY.md](./SECURITY.md) before opening issues.

## Why

Privacy work on Solana today hides **amounts** (Confidential Balances /
Token-2022 ZK extensions). It does not hide **addresses**. For institutions
the address is the bigger compliance risk:

> "Bank receives payment from a wallet that is added to the OFAC sanctions
> list six months later. Treasury is now linked on-chain to a sanctioned
> entity. Lawsuit."

g-pay puts an AML attestation gate **before** the funds touch any treasury
address, and uses fresh stealth addresses so there is no on-chain link
between sender, receiver, or the institution's main funds.

A longer write-up of the threat model and design lives in
[`docs/DESIGN.md`](./docs/DESIGN.md).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ SOLANA  (devnet → mainnet-beta)                                     │
│   programs/quarantine-vault/    init / deposit(_token) / attest /   │
│                                  release(_token) / refund(_token)   │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
                                │ RPC
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ SERVER stack (docker compose)                                       │
│   api-gateway  Hono + Postgres   Public REST API                    │
│   indexer      Rust + view-key   Polls program accounts, matches    │
│                                  via stealth-core, webhooks gateway │
│   relayer      Rust + Axum       Pays SOL fees, signs as fee payer  │
│   postgres                       Institutions, deposits, audit log  │
│   redis                          Rate-limit / queue (V2)            │
│   caddy                          TLS + reverse proxy                │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
                                │ HTTPS, X-API-Key
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DASHBOARD  (Vercel)                                                 │
│   apps/dashboard       Next.js 16 + Tailwind                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Workspace layout

```
programs/quarantine-vault/   Anchor 1.0 program (Rust, SBF target)
crates/
  stealth-core/              Ed25519 stealth address derivation + scan
  indexer/                   getProgramAccounts → view-key match → webhook
  relayer/                   HTTP fee-payer; admission policy
  cli/                       gpay-cli — operator workflow on a real RPC
  oracle-adapter/            AML adapter scaffold (Chainalysis/TRM wiring TODO)
apps/
  api-gateway/               Hono + Postgres; public API
  dashboard/                 Next.js dashboard for institutions
deploy/                      docker-compose.yml + Caddyfile + migrations
scripts/                     bootstrap-local, deploy-program-devnet, deploy-server
docs/                        DESIGN, RUNBOOK, DEPLOY, VERCEL
```

## Quick start (local)

Prerequisites: `solana ≥ 3.1`, `anchor ≥ 1.0`, `rustc ≥ 1.95`, `node ≥ 22`.

```sh
git clone <this repo>
cd g-pay

# 1. Per-deployer program keypair + sync IDs into source
solana-keygen new --no-bip39-passphrase --silent \
  --outfile target/deploy/quarantine_vault-keypair.json
anchor keys sync

# 2. Build everything
./scripts/build-artifacts.sh

# 3. Run unit + integration tests
cargo test --workspace
npm --prefix apps/api-gateway test

# 4. Boot local validator + deploy program + scaffold configs
./scripts/bootstrap-local.sh

# 5. In four terminals, run each service (commands at the end of bootstrap output)
```

For the full step-by-step including the on-chain demo (vault init → deposit
→ attestations → release / refund), see [`docs/RUNBOOK.md`](./docs/RUNBOOK.md).

## Deploy to your own server

```sh
# One-time:
#   ssh-keygen + put pubkey on the box, install docker on the host
./scripts/deploy-program-devnet.sh    # ships the program to devnet
./scripts/build-artifacts.sh          # cargo --release + tsc dist
./scripts/deploy-server.sh            # rsync + docker compose up --build -d
```

`deploy/.env.example` documents the required secrets (Postgres password, Redis
password, internal HMAC, RPC URL, program ID). Copy it to `deploy/.env` and
fill in values before running `deploy-server.sh`.

The dashboard deploys to Vercel separately — see [`docs/VERCEL.md`](./docs/VERCEL.md).

## What's implemented

- ✅ Anchor program (SOL + SPL-Token + Token-2022 deposits, all paths covered by LiteSVM tests)
- ✅ Ed25519 stealth address scheme — Rust crate + TypeScript port, byte-exact cross-language vector locked
- ✅ Indexer: `getProgramAccounts` polling, view-tag pre-filter, webhook to gateway
- ✅ Relayer: HTTP submit endpoint, fee-payer cosign, token-bucket rate limit, monthly fee cap
- ✅ Postgres-backed gateway with API-key auth + indexer internal endpoint
- ✅ Dashboard (deposit list, fresh-address generator, release / refund actions)
- ✅ Docker compose stack with Caddy reverse proxy
- ✅ End-to-end CLI for operator workflows

## Roadmap

- [ ] Real AML adapter (Chainalysis / TRM / Range)
- [ ] Webhook delivery to institution callbacks (with retry queue)
- [ ] Multi-relayer fail-over + geo-distribution
- [ ] TypeScript SDK packaged and published to npm
- [ ] WebSocket `programSubscribe` for sub-second deposit detection
- [ ] HSM/KMS-backed view-key scanning (replace the file-on-disk dev model)
- [ ] Third-party audit (OtterSec / Sec3) before any mainnet write

## Contributing

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md). The codebase is bilingual
(English code, English/Turkish prose in some docs); contributions in either
language are fine.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
