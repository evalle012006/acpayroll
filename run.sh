#!/bin/bash

# ============================================================
#  acpayroll — Auto Deploy Script
#  Usage: ./deploy.sh [branch]
#  Example: ./deploy.sh main
#  Default branch: main
# ============================================================

set -e  # Exit immediately on any error

# ── Config ───────────────────────────────────────────────────
APP_DIR=~/acpayroll
BRANCH=${1:-main}
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helpers ──────────────────────────────────────────────────
log()     { echo -e "${CYAN}[${TIMESTAMP}]${NC} $1"; }
success() { echo -e "${GREEN}✔ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
error()   { echo -e "${RED}✘ $1${NC}"; exit 1; }

# ── Banner ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       acpayroll — Auto Deployment        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check project directory ──────────────────────────────────
log "Checking project directory..."
if [ ! -d "$APP_DIR" ]; then
  error "Project directory $APP_DIR not found. Please set up the project first."
fi

cd "$APP_DIR"
success "Project directory found: $APP_DIR"

# ── Check docker-compose.yml exists ──────────────────────────
if [ ! -f "docker-compose.yml" ]; then
  error "docker-compose.yml not found in $APP_DIR"
fi

# ── Git pull latest code ──────────────────────────────────────
log "Fetching latest code from branch: ${YELLOW}$BRANCH${NC}..."

# Check if git repo
if [ ! -d ".git" ]; then
  error "Not a git repository. Initialize git or clone the project first."
fi

# Stash any local changes to avoid conflicts
# git stash --quiet && warn "Local changes stashed." || true

# Fetch and pull
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

success "Code updated to latest on branch: $BRANCH"

# ── Fix Linux case-sensitivity (Controllers → controllers) ────
if [ -d "$APP_DIR/backend/Controllers" ] && [ ! -d "$APP_DIR/backend/controllers" ]; then
  warn "Renaming Controllers → controllers for Linux compatibility..."
  mv "$APP_DIR/backend/Controllers" "$APP_DIR/backend/controllers"
  success "Renamed successfully."
fi

# ── Verify .env files exist ───────────────────────────────────
log "Checking environment files..."

if [ ! -f "$APP_DIR/.env" ]; then
  error ".env not found at $APP_DIR/.env — create it from env.example first."
fi

if [ ! -f "$APP_DIR/backend/.env" ]; then
  error ".env not found at $APP_DIR/backend/.env — create it first."
fi

success "Environment files found."

# ── Stop existing containers ──────────────────────────────────
log "Stopping running containers..."
docker compose down --remove-orphans
success "Containers stopped."

# ── Build and start containers ────────────────────────────────
log "Building and starting containers..."
docker compose up -d --build
success "Containers built and started."

# ── Wait for DB to be healthy ─────────────────────────────────
log "Waiting for database to be ready..."
RETRIES=15
COUNT=0
until docker exec acpayroll-db pg_isready -U postgres -d payroll -q 2>/dev/null; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $RETRIES ]; then
    error "Database did not become healthy in time. Check: docker compose logs acpayroll-db"
  fi
  echo -n "."
  sleep 3
done
echo ""
success "Database is healthy."

# ── Wait for backend to be ready ─────────────────────────────
log "Waiting for backend to be ready..."
RETRIES=15
COUNT=0
until docker exec acpayroll-backend wget -qO- http://localhost:3001/test &>/dev/null; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $RETRIES ]; then
    warn "Backend health check timed out. Check logs: docker compose logs acpayroll-backend"
    break
  fi
  echo -n "."
  sleep 3
done
echo ""
success "Backend is responding."

# ── Run database migrations ───────────────────────────────────
log "Running database migrations..."
if docker exec acpayroll-backend npm run migrate; then
  success "Migrations completed successfully."
else
  error "Migration failed. Check logs: docker compose logs acpayroll-backend"
fi

# ── Show container status ─────────────────────────────────────
echo ""
log "Container status:"
docker compose ps

# ── Tail logs briefly ────────────────────────────────────────
echo ""
log "Recent backend logs:"
docker compose logs acpayroll-backend --tail=20

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deployment complete! 🚀          ║${NC}"
echo -e "${GREEN}║   https://acpayroll.ambercashph.com      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""