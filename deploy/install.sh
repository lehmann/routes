#!/usr/bin/env bash
# Full setup script for Ubuntu Server.
# Run as root (or with sudo) on a fresh Ubuntu 22.04/24.04 instance.
#
# Usage:
#   sudo bash deploy/install.sh
#
# The script will:
#   1. Install system dependencies (Docker, Node.js 20, curl, git)
#   2. Clone the repo to /opt/routes (or use the current directory)
#   3. Download OSM and GTFS data for Berlin
#   4. Build the Next.js application
#   5. Build the OTP2 routing graph
#   6. Install and enable all systemd services
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

DEPLOY_DIR="/opt/routes"
REPO_URL="https://github.com/lehmann/routes.git"
BRANCH="main"
APP_PORT="3000"
OTP_PORT="8080"
DOCKER_MEMORY="8g"
DOCKER_HEAP="-Xmx6g"

# ── Helpers ───────────────────────────────────────────────────────────────────

info()  { echo -e "\033[1;34m[install]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[  ok  ]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[ warn ]\033[0m $*"; }
die()   { echo -e "\033[1;31m[ fail ]\033[0m $*" >&2; exit 1; }

require_root() {
  [ "$EUID" -eq 0 ] || die "This script must be run as root. Use: sudo bash deploy/install.sh"
}

check_memory() {
  TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  TOTAL_GB=$((TOTAL_KB / 1024 / 1024))
  if [ "$TOTAL_GB" -lt 9 ]; then
    warn "Only ${TOTAL_GB}GB RAM detected. OTP2 requires at least 9 GB to build the Berlin graph."
    warn "The build may fail. Consider upgrading to a larger instance."
    read -rp "Continue anyway? [y/N] " CONFIRM
    [[ "$CONFIRM" =~ ^[Yy]$ ]] || exit 1
  else
    ok "Memory: ${TOTAL_GB}GB available."
  fi
}

# ── 1. System dependencies ─────────────────────────────────────────────────────

install_deps() {
  info "Updating apt..."
  apt-get update -qq

  info "Installing base packages..."
  apt-get install -y -qq curl git ca-certificates gnupg lsb-release

  # Docker
  if ! command -v docker &>/dev/null; then
    info "Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    ok "Docker installed."
  else
    ok "Docker already installed: $(docker --version)"
  fi

  # Node.js 20
  if ! node --version 2>/dev/null | grep -q "^v20"; then
    info "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    ok "Node.js installed: $(node --version)"
  else
    ok "Node.js 20 already installed: $(node --version)"
  fi
}

# ── 2. Repo setup ──────────────────────────────────────────────────────────────

setup_repo() {
  if [ -d "$DEPLOY_DIR/.git" ]; then
    info "Repo already at $DEPLOY_DIR — pulling latest..."
    cd "$DEPLOY_DIR"
    git pull origin "$BRANCH" --ff-only
  else
    info "Cloning repository to $DEPLOY_DIR..."
    git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
  fi

  # Ensure scripts are executable
  chmod +x "$DEPLOY_DIR"/scripts/*.sh
  chmod +x "$DEPLOY_DIR"/deploy/install.sh
}

# ── 3. OTP data ────────────────────────────────────────────────────────────────

download_data() {
  OSM_FILE="$DEPLOY_DIR/otp-data/berlin.osm.pbf"
  GTFS_FILE="$DEPLOY_DIR/otp-data/vbb-gtfs.zip"

  if [ ! -f "$OSM_FILE" ]; then
    info "Downloading Berlin OSM extract (~95 MB)..."
    curl -fsSL --retry 3 \
      https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf \
      -o "$OSM_FILE"
    ok "OSM data downloaded."
  else
    ok "OSM data already present."
  fi

  if [ ! -f "$GTFS_FILE" ]; then
    info "Downloading VBB GTFS (~73 MB)..."
    curl -fsSL --retry 3 \
      https://unternehmen.vbb.de/gtfs \
      -o "$GTFS_FILE"
    ok "GTFS data downloaded."
  else
    ok "GTFS data already present."
  fi
}

# ── 4. Environment ─────────────────────────────────────────────────────────────

setup_env() {
  ENV_FILE="$DEPLOY_DIR/app/.env.local"
  if [ ! -f "$ENV_FILE" ]; then
    info "Creating app/.env.local..."
    cat > "$ENV_FILE" <<EOF
OTP_URL=http://localhost:${OTP_PORT}/otp/gtfs/v1
EOF
    ok ".env.local created."
  else
    ok ".env.local already exists."
  fi
}

# ── 5. Next.js build ───────────────────────────────────────────────────────────

build_app() {
  info "Building Next.js application..."
  bash "$DEPLOY_DIR/scripts/build.sh"
  ok "Next.js build complete."
}

# ── 6. OTP graph build ─────────────────────────────────────────────────────────

build_graph() {
  GRAPH_FILE="$DEPLOY_DIR/otp-data/graph.obj"
  if [ -f "$GRAPH_FILE" ]; then
    ok "OTP graph already exists — skipping build."
    return
  fi

  info "Building OTP2 routing graph (~10 minutes, requires ~8 GB RAM)..."
  cd "$DEPLOY_DIR"
  docker compose run --rm otp --build --save
  ok "OTP graph built."
}

# ── 7. Systemd services ────────────────────────────────────────────────────────

install_services() {
  SYSTEMD_DIR="/etc/systemd/system"
  SERVICES=(routes-otp routes-app routes-sync routes-gtfs)

  info "Installing systemd service files..."
  for svc in "${SERVICES[@]}"; do
    cp "$DEPLOY_DIR/deploy/${svc}.service" "$SYSTEMD_DIR/"
    # Patch DEPLOY_DIR into service files if needed (they use /opt/routes by default)
    if [ "$DEPLOY_DIR" != "/opt/routes" ]; then
      sed -i "s|/opt/routes|$DEPLOY_DIR|g" "$SYSTEMD_DIR/${svc}.service"
    fi
  done

  for timer in routes-sync routes-gtfs; do
    cp "$DEPLOY_DIR/deploy/${timer}.timer" "$SYSTEMD_DIR/"
  done

  # Patch Node.js path in routes-app.service
  NODE_PATH=$(command -v node)
  sed -i "s|/usr/bin/node|$NODE_PATH|g" "$SYSTEMD_DIR/routes-app.service"

  # Patch docker compose path in routes-otp.service
  DOCKER_PATH=$(command -v docker)
  sed -i "s|/usr/bin/docker|$DOCKER_PATH|g" "$SYSTEMD_DIR/routes-otp.service"

  systemctl daemon-reload
  ok "Service files installed."

  info "Enabling and starting services..."
  systemctl enable --now routes-otp.service
  systemctl enable --now routes-app.service
  systemctl enable --now routes-sync.timer
  systemctl enable --now routes-gtfs.timer

  ok "All services enabled."
}

# ── Main ───────────────────────────────────────────────────────────────────────

main() {
  require_root
  check_memory

  info "=== Routes — Ubuntu Server Install ==="
  info "Deploy path : $DEPLOY_DIR"
  info "Repository  : $REPO_URL"
  info "Branch      : $BRANCH"
  echo ""

  install_deps
  setup_repo
  download_data
  setup_env
  build_app
  build_graph
  install_services

  echo ""
  ok "=== Installation complete ==="
  echo ""
  echo "  Frontend : http://$(hostname -I | awk '{print $1}'):${APP_PORT}"
  echo "  OTP2 API : http://$(hostname -I | awk '{print $1}'):${OTP_PORT}/otp/gtfs/v1"
  echo "  GraphiQL : http://$(hostname -I | awk '{print $1}'):${OTP_PORT}/graphiql"
  echo ""
  echo "  Service status:"
  systemctl is-active routes-otp.service routes-app.service routes-sync.timer routes-gtfs.timer || true
  echo ""
  echo "  View logs:"
  echo "    journalctl -u routes-app -f"
  echo "    journalctl -u routes-otp -f"
  echo "    journalctl -u routes-sync -f"
}

main "$@"
