#!/usr/bin/env bash
# Deploy g-pay backend to a remote Linux box that already has docker + compose.
# Pre-requisites:
#   - ./scripts/build-artifacts.sh has been run (cargo + tsc done locally)
#   - SSH key auth is set up
#   - deploy/.env exists locally OR will be created from .env.example on first run
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

SERVER="${GPAY_SERVER:-deploy@212.64.210.20}"
KEY="${GPAY_SSH_KEY:-$HOME/.ssh/id_ed25519_gpay}"
REMOTE="${GPAY_REMOTE_DIR:-/home/deploy/g-pay}"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new)
RSYNC_E="ssh -i $KEY -o StrictHostKeyChecking=accept-new"

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }

# --- Pre-flight ----------------------------------------------------------------
step "Pre-flight"
[[ -x target/release/gpay-indexer ]] || { echo "missing target/release/gpay-indexer — run build-artifacts.sh first"; exit 1; }
[[ -x target/release/gpay-relayer ]] || { echo "missing target/release/gpay-relayer"; exit 1; }
[[ -x target/release/gpay-cli     ]] || { echo "missing target/release/gpay-cli (cargo build --release -p gpay-cli)"; exit 1; }
[[ -d apps/api-gateway/dist ]]       || { echo "missing apps/api-gateway/dist — run build-artifacts.sh first"; exit 1; }
[[ -f deploy/.env ]] || {
  echo "deploy/.env not found — copy from .env.example and fill in PG/REDIS/INTERNAL secrets, then re-run."
  exit 1
}

# --- Ensure remote dirs --------------------------------------------------------
step "Preparing remote layout"
"${SSH[@]}" "$SERVER" "mkdir -p $REMOTE/{deploy,apps/api-gateway,crates/indexer,crates/relayer,target/release,config}"

# --- Sync code + Dockerfiles + compose -----------------------------------------
step "rsync project files"
rsync -e "$RSYNC_E" -azR \
  package.json \
  package-lock.json \
  apps/api-gateway/package.json \
  apps/api-gateway/Dockerfile \
  apps/dashboard/package.json \
  apps/api-gateway/dist/ \
  crates/indexer/Dockerfile \
  crates/relayer/Dockerfile \
  target/release/gpay-indexer \
  target/release/gpay-relayer \
  target/release/gpay-cli \
  deploy/docker-compose.yml \
  deploy/Caddyfile \
  deploy/.env \
  deploy/migrations/ \
  "$SERVER:$REMOTE/"

# --- Sync runtime config (slices.json, relayer keypair) ------------------------
if [[ -f config/slices.json ]]; then
  step "rsync config/slices.json"
  rsync -e "$RSYNC_E" -az config/slices.json "$SERVER:$REMOTE/config/"
else
  echo "  ⚠ config/slices.json missing — copy slices.example.json to slices.json or run bootstrap-local.sh"
fi

if [[ -f config/relayer-keypair.json ]]; then
  step "rsync config/relayer-keypair.json"
  rsync -e "$RSYNC_E" -az config/relayer-keypair.json "$SERVER:$REMOTE/config/"
else
  step "Generating fresh relayer keypair on server"
  "${SSH[@]}" "$SERVER" "[ -f $REMOTE/config/relayer-keypair.json ] || \
    docker run --rm -v $REMOTE/config:/work alpine:3 sh -c \
    'apk add --no-cache openssl >/dev/null && openssl rand 64 > /work/.tmp && rm /work/.tmp' || true"
  echo "  ⚠ Generate the relayer keypair locally with solana-keygen and re-run, OR ssh in and run solana-keygen by hand."
fi

# --- Bring stack up ------------------------------------------------------------
step "docker compose up --build -d"
"${SSH[@]}" "$SERVER" "cd $REMOTE/deploy && docker compose --env-file .env up --build -d"

# --- Health checks -------------------------------------------------------------
step "Smoke test"
"${SSH[@]}" "$SERVER" "
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf http://127.0.0.1/healthz >/dev/null; then
      echo '  ✔ http://127.0.0.1/healthz returned 200'
      curl -s http://127.0.0.1/healthz; echo
      exit 0
    fi
    sleep 3
  done
  echo '  ✗ healthz did not respond — see: docker compose logs api-gateway'
  exit 1
"

cat <<EOF

\033[1;32m✔ g-pay deployed.\033[0m
  Public URL:  http://${SERVER#*@}/
  Healthcheck: http://${SERVER#*@}/healthz

Logs:
  ssh ${SERVER} 'cd $REMOTE/deploy && docker compose logs -f --tail=50'

Bring down:
  ssh ${SERVER} 'cd $REMOTE/deploy && docker compose down'
EOF
