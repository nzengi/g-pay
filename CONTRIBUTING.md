# Contributing to g-pay

Thanks for your interest. g-pay is an early-stage research-and-engineering
project; PRs and issues are welcome — code, docs, threat-model critiques,
and small fixes alike.

## Ground rules

- **Do not push real keypairs, mnemonics, API keys, or `.env` files.**
  `.gitignore` covers the obvious files; if you create new secret material
  while developing, add the path before committing.
- **The Anchor program is not audited.** Do not propose changes that depend
  on assumptions about mainnet hardening that we have not yet earned.
- Be considerate of compute and rent costs in any program-side change.

## Local setup

```sh
solana --version       # >= 3.1
anchor --version       # >= 1.0
rustc --version        # >= 1.95
node --version         # >= 22

# per-deployer keypair (do NOT reuse the demo program ID)
solana-keygen new --no-bip39-passphrase --silent \
  --outfile target/deploy/quarantine_vault-keypair.json
anchor keys sync

# build + test
./scripts/build-artifacts.sh
cargo test --workspace
npm --prefix apps/api-gateway test
```

`docs/RUNBOOK.md` has the full local end-to-end demo.

## Coding style

- **Rust**: `cargo fmt` before pushing. Prefer functions to macros, explicit
  error types in libraries.
- **TypeScript**: 2-space indent, double quotes, strict mode. The
  `tsconfig.json` is the source of truth.
- **Comments**: only when the *why* is non-obvious. Identifier names should
  carry the *what*.

## Pull request checklist

- [ ] `cargo test --workspace` passes
- [ ] `npm --prefix apps/api-gateway test` passes
- [ ] `npm --prefix apps/dashboard run build` passes
- [ ] If you touched `programs/quarantine-vault/`, the LiteSVM integration
      tests still cover the new path
- [ ] If you changed the stealth-core algorithm, the canonical vector test
      (`crates/stealth-core/tests/vectors.rs`) still passes byte-for-byte and
      the TS port (`apps/api-gateway/src/stealth.ts`) was updated
- [ ] Documentation in `docs/` and `README.md` updated if behavior changed

## Reporting bugs

For functional bugs and feature requests, open a GitHub issue with:
- what you ran
- what you expected
- what you got
- environment (`solana --version`, `anchor --version`, `rustc --version`, `node --version`)

For security issues, follow [SECURITY.md](./SECURITY.md) — please do not open
public issues for vulnerabilities.

## Languages

The codebase is English. Issues, PRs, and design notes in either English or
Turkish are welcome — reviewers are bilingual.
