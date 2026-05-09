#!/usr/bin/env bash
# Bootstrap local g-pay dev: solana-test-validator + program deploy + config files.
# Idempotent — safe to re-run; will not stomp existing keypairs.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

VALIDATOR_LEDGER="${VALIDATOR_LEDGER:-$REPO/.local/test-ledger}"
VALIDATOR_LOG="${VALIDATOR_LOG:-$REPO/.local/test-validator.log}"
RELAYER_KEYPAIR="${RELAYER_KEYPAIR:-$REPO/config/relayer-keypair.json}"
AUTHORITY_KEYPAIR="${AUTHORITY_KEYPAIR:-$REPO/config/authority-keypair.json}"
SLICES_FILE="${SLICES_FILE:-$REPO/config/slices.json}"
PROGRAM_KEYPAIR="$REPO/target/deploy/quarantine_vault-keypair.json"
PROGRAM_SO="$REPO/target/deploy/quarantine_vault.so"
RPC="http://127.0.0.1:8899"

mkdir -p "$REPO/.local"

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }

step "Building Anchor program (release/SBF)"
if [[ ! -f "$PROGRAM_SO" ]]; then
  anchor build
else
  echo "  using existing $PROGRAM_SO (delete to force rebuild)"
fi

step "Generating relayer keypair if missing"
if [[ ! -f "$RELAYER_KEYPAIR" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$RELAYER_KEYPAIR"
fi
RELAYER_PUB="$(solana address -k "$RELAYER_KEYPAIR")"
echo "  relayer pubkey: $RELAYER_PUB"

step "Generating institution authority keypair if missing"
if [[ ! -f "$AUTHORITY_KEYPAIR" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$AUTHORITY_KEYPAIR"
fi
AUTHORITY_PUB="$(solana address -k "$AUTHORITY_KEYPAIR")"
echo "  authority pubkey: $AUTHORITY_PUB"

step "Writing demo slices file if missing"
if [[ ! -f "$SLICES_FILE" ]]; then
  cp "$REPO/config/slices.example.json" "$SLICES_FILE"
  echo "  copied example slices to $SLICES_FILE"
else
  echo "  $SLICES_FILE already present"
fi

step "Killing any previous solana-test-validator"
pkill -f solana-test-validator >/dev/null 2>&1 || true
sleep 1

step "Starting solana-test-validator"
rm -rf "$VALIDATOR_LEDGER"
nohup solana-test-validator \
  --ledger "$VALIDATOR_LEDGER" \
  --rpc-port 8899 \
  --bpf-program "$(solana address -k "$PROGRAM_KEYPAIR")" "$PROGRAM_SO" \
  --quiet \
  > "$VALIDATOR_LOG" 2>&1 &
VALIDATOR_PID=$!
echo "  validator PID: $VALIDATOR_PID, log: $VALIDATOR_LOG"

step "Waiting for RPC to come up"
for i in $(seq 1 60); do
  if solana cluster-version --url "$RPC" >/dev/null 2>&1; then
    echo "  RPC up after ${i}s"
    break
  fi
  sleep 1
done

step "Airdropping SOL to relayer + authority"
solana airdrop --url "$RPC" 10 "$RELAYER_PUB" >/dev/null
solana airdrop --url "$RPC" 10 "$AUTHORITY_PUB" >/dev/null
echo "  relayer balance:   $(solana balance --url "$RPC" "$RELAYER_PUB")"
echo "  authority balance: $(solana balance --url "$RPC" "$AUTHORITY_PUB")"

PROGRAM_ID="$(solana address -k "$PROGRAM_KEYPAIR")"

cat <<EOF

\033[1;32m✔ Local environment ready.\033[0m

  Program ID:          $PROGRAM_ID
  RPC:                 $RPC
  Relayer keypair:     $RELAYER_KEYPAIR
  Authority keypair:   $AUTHORITY_KEYPAIR
  Slices file:         $SLICES_FILE
  Validator log:       $VALIDATOR_LOG

Next: open four terminals and run

  # 1. Relayer
  GPAY_RPC_URL=$RPC \\
  GPAY_RELAYER_KEYPAIR=$RELAYER_KEYPAIR \\
  GPAY_RELAYER_BIND=127.0.0.1:4000 \\
    cargo run -p gpay-relayer --release

  # 2. Indexer
  GPAY_RPC_URL=$RPC \\
  GPAY_GATEWAY_URL=http://127.0.0.1:3000 \\
  GPAY_INTERNAL_SECRET=dev-internal-secret-rotate \\
  GPAY_PROGRAM_ID=$PROGRAM_ID \\
  GPAY_SLICES_FILE=$SLICES_FILE \\
  GPAY_SCAN_INTERVAL_MS=4000 \\
    cargo run -p gpay-indexer --release

  # 3. API gateway
  PORT=3000 GPAY_INTERNAL_SECRET=dev-internal-secret-rotate \\
    npm --prefix apps/api-gateway run start

  # 4. Dashboard
  npm --prefix apps/dashboard run dev   # http://localhost:3001
EOF
