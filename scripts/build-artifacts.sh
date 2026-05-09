#!/usr/bin/env bash
# Build everything the server's Docker images need:
#   - target/release/gpay-indexer
#   - target/release/gpay-relayer
#   - apps/api-gateway/dist/
#
# Run from a workstation with cargo + node + npm. Heavy CPU/RAM here so the
# 1 vCPU / 2 GB server only does COPY-shaped Docker builds.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

step() { printf "\n\033[1;36m▸ %s\033[0m\n" "$*"; }

step "cargo build --release -p gpay-indexer -p gpay-relayer"
cargo build --release -p gpay-indexer -p gpay-relayer

step "tsc — apps/api-gateway"
npm --prefix apps/api-gateway run build

step "Artifact summary"
ls -lh target/release/gpay-indexer target/release/gpay-relayer
echo
echo "  apps/api-gateway/dist/$(ls apps/api-gateway/dist | head -3 | tr '\n' ' ')"

cat <<EOF

\033[1;32m✔ Build artifacts ready.\033[0m

Next: ./scripts/deploy-server.sh  to push to ***REDACTED***.
EOF
