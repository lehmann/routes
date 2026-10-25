#!/usr/bin/env bash
# Build the Next.js production bundle.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$DEPLOY_DIR/app"

echo "[build] Installing dependencies..."
cd "$APP_DIR"
npm ci --include=dev

echo "[build] Building Next.js application..."
NODE_ENV=production npm run build

echo "[build] Done."
