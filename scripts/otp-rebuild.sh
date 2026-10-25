#!/usr/bin/env bash
# Rebuild the OTP2 routing graph from OSM + GTFS data.
# Stops the running OTP service, builds the graph, then restarts in load mode.
# Takes ~10 minutes. OTP2 will be unavailable during the rebuild.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[otp-rebuild] Stopping OTP service..."
systemctl stop routes-otp.service

echo "[otp-rebuild] Building graph (this takes ~10 minutes)..."
cd "$DEPLOY_DIR"
# Override the compose command to build + save without serving.
# The volume mount in docker-compose.yml ensures graph.obj is written to otp-data/.
docker compose run --rm otp --build --save

echo "[otp-rebuild] Starting OTP service in load mode..."
systemctl start routes-otp.service

echo "[otp-rebuild] Waiting for OTP to become ready (up to 5 min)..."
for i in $(seq 1 60); do
  if curl -sf http://localhost:8080/otp/gtfs/v1 \
       -X POST -H "Content-Type: application/json" \
       -d '{"query":"{ __typename }"}' > /dev/null 2>&1; then
    echo "[otp-rebuild] OTP is ready."
    exit 0
  fi
  sleep 5
done

echo "[otp-rebuild] ERROR: OTP did not become ready within 5 minutes." >&2
exit 1
