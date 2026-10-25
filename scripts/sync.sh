#!/usr/bin/env bash
# Pull latest changes from GitHub and restart affected services.
# Run by routes-sync.timer every 5 minutes.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${GH_BRANCH:-main}"

cd "$DEPLOY_DIR"

# Fetch without merging first to detect changes
git fetch origin "$BRANCH" --quiet

CHANGES=$(git diff --name-only HEAD "origin/$BRANCH" 2>/dev/null || true)

if [ -z "$CHANGES" ]; then
  echo "[sync] Already up to date."
  exit 0
fi

echo "[sync] Changes detected:"
echo "$CHANGES"
echo "---"

git pull origin "$BRANCH" --ff-only

APP_CHANGED=$(echo "$CHANGES" | grep -c '^app/' || true)
OTP_CONFIG_CHANGED=$(echo "$CHANGES" | grep -c '^otp-data/.*\.json$' || true)
DOCKER_CHANGED=$(echo "$CHANGES" | grep -c '^docker-compose\.yml$' || true)

if [ "$APP_CHANGED" -gt 0 ]; then
  echo "[sync] App code changed — rebuilding Next.js..."
  bash "$DEPLOY_DIR/scripts/build.sh"
  echo "[sync] Restarting routes-app..."
  systemctl restart routes-app.service
fi

if [ "$OTP_CONFIG_CHANGED" -gt 0 ] || [ "$DOCKER_CHANGED" -gt 0 ]; then
  echo "[sync] OTP config or Docker Compose changed — restarting routes-otp..."
  systemctl restart routes-otp.service
fi

echo "[sync] Sync complete."
