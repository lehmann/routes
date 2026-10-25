#!/usr/bin/env bash
# Build the Next.js image via Docker Compose (Node 20 fica dentro do container).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[build] Building app image..."
cd "$DEPLOY_DIR"
docker compose build app

echo "[build] Done."
