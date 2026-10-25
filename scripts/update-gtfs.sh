#!/usr/bin/env bash
# Download the latest VBB GTFS feed and rebuild the OTP graph if it changed.
# VBB publishes updates twice a week. This script is run weekly by routes-gtfs.timer.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GTFS_URL="https://unternehmen.vbb.de/gtfs"
GTFS_FILE="$DEPLOY_DIR/otp-data/vbb-gtfs.zip"
GTFS_TMP="${GTFS_FILE}.tmp"

echo "[gtfs] Downloading latest VBB GTFS..."
curl -fsSL --retry 3 --retry-delay 10 -o "$GTFS_TMP" "$GTFS_URL"

if [ -f "$GTFS_FILE" ]; then
  NEW_MD5=$(md5sum "$GTFS_TMP" | cut -d' ' -f1)
  OLD_MD5=$(md5sum "$GTFS_FILE" | cut -d' ' -f1)
  if [ "$NEW_MD5" = "$OLD_MD5" ]; then
    echo "[gtfs] GTFS unchanged — skipping rebuild."
    rm "$GTFS_TMP"
    exit 0
  fi
fi

echo "[gtfs] New GTFS detected — replacing and rebuilding OTP graph..."
mv "$GTFS_TMP" "$GTFS_FILE"

bash "$DEPLOY_DIR/scripts/otp-rebuild.sh"

echo "[gtfs] Update complete."
