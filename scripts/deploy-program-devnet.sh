#!/usr/bin/env bash
# Deploy quarantine_vault program to Solana devnet.
# Idempotent: re-running upgrades the existing program (same keypair).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

PROGRAM_KEYPAIR="$REPO/target/deploy/quarantine_vault-keypair.json"
PROGRAM_SO="$REPO/target/deploy/quarantine_vault.so"
PROGRAM_ID="$(solana address -k "$PROGRAM_KEYPAIR")"

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }

step "Setting cluster to devnet"
solana config set --url https://api.devnet.solana.com >/dev/null

step "Wallet"
solana address
solana balance

step "Program ID"
echo "  $PROGRAM_ID"
solana program show "$PROGRAM_ID" 2>/dev/null && echo "  (already deployed — this run will UPGRADE)" || echo "  (first-time deployment)"

step "Building program (release)"
[[ -f "$PROGRAM_SO" ]] || anchor build

step "Deploying"
solana program deploy "$PROGRAM_SO" \
  --program-id "$PROGRAM_KEYPAIR" \
  --max-sign-attempts 30 \
  --use-rpc \
  -u devnet

step "Verifying"
solana program show "$PROGRAM_ID"

cat <<EOF

\033[1;32m✔ Program live on devnet.\033[0m

Update deploy/.env on the server with:
  PROGRAM_ID=$PROGRAM_ID
  GPAY_RPC_URL=https://api.devnet.solana.com
EOF
