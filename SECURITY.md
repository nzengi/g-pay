# Security policy

g-pay handles cryptographic key material and on-chain value flows. Treat any
weakness in the codebase as potentially high-impact even though we are pre-audit
and devnet-only at the moment.

## Reporting a vulnerability

**Please do not open a public GitHub issue for vulnerabilities.**

Instead, email the maintainers (replace the placeholder once a contact address
is set up) with:

- a clear description of the issue
- reproduction steps and proof-of-concept if possible
- the commit hash or release tag you tested
- whether you have already disclosed this elsewhere

We will respond within 5 business days to acknowledge receipt and propose a
remediation timeline.

## Scope

In scope:
- The Anchor program at `programs/quarantine-vault/`
- The stealth-address scheme (`crates/stealth-core/`) and its TypeScript port
  (`apps/api-gateway/src/stealth.ts`)
- The indexer's webhook authentication and RPC trust boundary
- The relayer's transaction admission, signature, and fee-payer logic
- The API gateway's authentication, authorization, and SQL handling
- Docker and compose configuration that affects exposure of secrets

Out of scope (for now):
- Devnet-only test data, demo keypairs, or seeded credentials in fixtures
- Issues in Solana itself, Anchor framework, or third-party dependencies
  (please report to those projects directly)
- Denial-of-service against the public devnet RPC

## Known limitations

The following are explicitly known weaknesses in the current codebase. They do
not require disclosure but PRs that close them are welcome:

- The Anchor program is **not audited**. Do not move real value through it.
- The AML oracle is a stub; signed attestations are not yet sourced from a real
  Chainalysis / TRM / Range integration.
- View keys live on disk in dev (`config/slices.json`). Production deployments
  must back this with HSM/KMS.
- Relayer keypair is loaded from a JSON file; production should use a remote
  signer.
- The dashboard stores the institution API key in `localStorage` for V1; this
  must move to a proper auth scheme before any real customer onboarding.
- The deployment HTTP-only setup at `deploy/Caddyfile` is for IP-only
  bring-up. Pointing a domain enables Caddy auto-TLS — do that before any
  external use.

## Cryptographic assumptions

The stealth-address derivation relies on:

- Curve25519 / Ed25519 group, prime-order subgroup
- SHA-512 (used inside the curve scheme and for view-tag derivation)
- Per-deposit randomness with sufficient entropy

The cross-language vector test in `crates/stealth-core/tests/vectors.rs` and
`apps/api-gateway/tests/vector.test.ts` locks the exact algorithm and provides
byte-exact agreement between Rust and TypeScript implementations. Any algorithmic
change must update both sides and the locked vectors together.
