# g-pay local runbook

V1+V2'nin tamamı yerelde çalıştırılır. **Docker, Postgres, Redis YOK** — bunlar sunucuya geçince eklenir. Tüm state ya in-memory (gateway), ya dosya (config/), ya da test-validator ledger (geçici).

## Önkoşullar

```sh
solana --version       # >= 3.1
anchor --version       # >= 1.0
rustc --version        # >= 1.95
node --version         # >= 22
```

## Tek seferlik kurulum

```sh
# Lokalden:
./scripts/bootstrap-local.sh
```

Bu script:
1. Anchor program'ı SBF için derler
2. Relayer + authority keypair'ları üretir (yoksa)
3. Demo slices dosyasını kopyalar (yoksa)
4. `solana-test-validator`'ı başlatır ve programı önceden yükler
5. Relayer + authority'e 10 SOL airdrop'lar
6. Sonraki adımlar için komutları yazdırır

## Servisleri başlatma (4 terminal)

```sh
# Terminal 1 — Relayer (HTTP submit endpoint, fee payer)
GPAY_RPC_URL=http://127.0.0.1:8899 \
GPAY_RELAYER_KEYPAIR=config/relayer-keypair.json \
GPAY_RELAYER_BIND=127.0.0.1:4000 \
  cargo run -p gpay-relayer --release
```

```sh
# Terminal 2 — Indexer (RPC poll → gateway webhook)
GPAY_RPC_URL=http://127.0.0.1:8899 \
GPAY_GATEWAY_URL=http://127.0.0.1:3000 \
GPAY_INTERNAL_SECRET=dev-internal-secret-rotate \
GPAY_PROGRAM_ID=$(solana address -k target/deploy/quarantine_vault-keypair.json) \
GPAY_SLICES_FILE=config/slices.json \
GPAY_SCAN_INTERVAL_MS=4000 \
  cargo run -p gpay-indexer --release
```

```sh
# Terminal 3 — API gateway
PORT=3000 GPAY_INTERNAL_SECRET=dev-internal-secret-rotate \
  npm --prefix apps/api-gateway run start
```

```sh
# Terminal 4 — Dashboard
npm --prefix apps/dashboard run dev
# http://localhost:3001
# API key: demo-key-please-rotate
```

## End-to-end demo akışı (gpay-cli ile)

Bootstrap ve 4 servis çalışırken ayrı bir terminal aç. Authority + 3 oracle keypair'ı ile vault'u kur:

```sh
# Helper: ortam değişkenleri
export RPC=http://127.0.0.1:8899
export AUTH=config/authority-keypair.json
export AUTH_PK=$(solana address -k $AUTH)
export PROGRAM_ID=$(solana address -k target/deploy/quarantine_vault-keypair.json)

# Oracle keypair'ları (3 tane), her biri 1 SOL ile fonla
mkdir -p config/oracles
for i in 1 2 3; do
  solana-keygen new --no-bip39-passphrase --silent --outfile config/oracles/o$i.json
  solana airdrop --url $RPC 1 $(solana address -k config/oracles/o$i.json) >/dev/null
done
ORACLES="$(solana address -k config/oracles/o1.json),$(solana address -k config/oracles/o2.json),$(solana address -k config/oracles/o3.json)"

# 1) Vault'u başlat (m=2 of n=3)
cargo run -p gpay-cli -- init-vault \
  --authority-keypair $AUTH \
  --oracles "$ORACLES" \
  --threshold 2

# 2) Demo customer keypair (depositor) hazırla
solana-keygen new --no-bip39-passphrase --silent --outfile config/customer.json
solana airdrop --url $RPC 5 $(solana address -k config/customer.json) >/dev/null
export CUSTOMER_PK=$(solana address -k config/customer.json)

# 3) Customer demo institution'ın stealth address'ine 0.5 SOL deposit'liyor
DEPOSIT_OUT=$(cargo run -p gpay-cli -- deposit-sol \
  --depositor-keypair config/customer.json \
  --vault-authority $AUTH_PK \
  --spend-pub-hex 616e237719716e25ead63d831f9117f79b5aa05af8be30ff0eddb3dc43e8bdcf \
  --view-pub-hex 3e97bbe3dad77cdbab3b9d7a5af963868b2ee668470874b566dad4a32076c98b \
  --nonce 0 \
  --amount-lamports 500000000 \
  --refund-addr $CUSTOMER_PK \
  --release-authority $AUTH_PK \
  --expire-seconds 3600)
echo "$DEPOSIT_OUT" | tail -1 > /tmp/deposit.json
STEALTH=$(jq -r .stealth_pubkey /tmp/deposit.json)
EPHEMERAL=$(jq -r .ephemeral_r_hex /tmp/deposit.json)
DEPOSIT_PDA=$(jq -r .deposit_pda /tmp/deposit.json)

# 4) İndexer ~4s içinde detect edip gateway'e webhook atar.
#    Dashboard /deposits sayfasında on_chain_address dolu görür.

# 5) İki oracle "clean" attest eder (m=2/n=3 threshold dolar → Approved)
for i in 1 2; do
  cargo run -p gpay-cli -- attest \
    --oracle-keypair config/oracles/o$i.json \
    --vault-authority $AUTH_PK \
    --deposit-pubkey $DEPOSIT_PDA \
    --stealth-pubkey $STEALTH \
    --ephemeral-r-hex $EPHEMERAL \
    --verdict clean
done

# 6) Authority hazinedeki bir slice'a release eder
solana-keygen new --no-bip39-passphrase --silent --outfile config/treasury-slice.json
TARGET=$(solana address -k config/treasury-slice.json)
cargo run -p gpay-cli -- release-sol \
  --release-authority-keypair $AUTH \
  --vault-authority $AUTH_PK \
  --stealth-pubkey $STEALTH \
  --ephemeral-r-hex $EPHEMERAL \
  --target $TARGET

# Doğrulama: target hesabında ~0.5 SOL var
solana balance --url $RPC $TARGET
```

Reject yolu için aynısı ama 6 yerine 2 kez `--verdict dirty`, sonra:

```sh
cargo run -p gpay-cli -- refund-sol \
  --caller-keypair config/customer.json \
  --vault-authority $AUTH_PK \
  --stealth-pubkey $STEALTH \
  --ephemeral-r-hex $EPHEMERAL \
  --refund-target $CUSTOMER_PK
```

## Durum (V1.5 itibarıyla)

| Component | Local | Server (sonra) |
|-----------|-------|----------------|
| Anchor program | ✓ build + deploy | ✓ devnet/mainnet |
| Stealth derivation (Rust + TS) | ✓ vector-locked | aynı |
| Indexer RPC scan | ✓ poll loop | + websocket subscribe |
| Relayer fee-payer + admission | ✓ HTTP server | + multi-relayer |
| API gateway | ✓ in-memory | + Postgres + auth |
| Dashboard | ✓ Next 16 dev | Vercel |
| AML oracle | scaffold | + Chainalysis adapter |
| SPL token deposits | program tarafı ✓ | + integration test |
| Webhook → institution | yok | + retry queue |
| TS SDK paketi | yok | + npm publish |

## Test özeti

```sh
cargo test --workspace                              # 22 Rust tests
npm --prefix apps/api-gateway test                  # 7 TS tests
npm --prefix apps/dashboard run build               # type check
```

## Komponent listesi

```
programs/quarantine-vault/  Anchor program — init/deposit(_token)/attest/release(_token)/refund(_token)
crates/stealth-core/        Ed25519 stealth address (Rust); cross-language vector locked with TS
crates/indexer/             RPC poll + view-key scan + gateway webhook
crates/relayer/             Axum HTTP server + admission policy + fee-payer cosign + RPC submit
crates/cli/                 gpay-cli — operator workflow on a real validator
crates/oracle-adapter/      AML adapter scaffold (Chainalysis/TRM wiring TODO)
apps/api-gateway/           Hono + Node — REST API, in-memory store, internal indexer endpoint
apps/dashboard/             Next.js 16 — login, deposits list, new address, detail w/ release/refund
config/                     Local-only keypairs, slices.json, generated by bootstrap
scripts/bootstrap-local.sh  One-shot validator + deploy + key + slices generator
```

## Sıkça karşılaşılan

- **`anchor keys sync`**: program ID değiştiyse src + Anchor.toml yeniden eşitlemek için.
- **Validator önceden ayakta**: `pkill -f solana-test-validator` ile temizle.
- **Indexer `getProgramAccounts` boş**: deposit yapılmamış olabilir, sadece vault var; veya `GPAY_PROGRAM_ID` yanlış.
- **Gateway 403 internal**: `GPAY_INTERNAL_SECRET` indexer ve gateway'de aynı olmalı.
