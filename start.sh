#!/usr/bin/env bash

# ==============================================================================
#  AROS PACS — Master Startup Script
#  Launches all infrastructure (Docker, Orthanc, Redis, Postgres),
#  backend microservices (Core API, Clinic API), and
#  frontend portals (Clinic, Patient, Physician, DICOM Viewer).
# ==============================================================================

set -e

# Project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

LOGS_DIR="$ROOT_DIR/.logs"
PID_FILE="$ROOT_DIR/.pids"
NAMES_FILE="$ROOT_DIR/.pids_named"
mkdir -p "$LOGS_DIR"

# Color formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
MAGENTA="\033[0;35m"
NC="\033[0m" # No Color

# Banner
print_banner() {
  clear 2>/dev/null || true
  echo -e "${CYAN}${BOLD}"
  echo "    ___    ____  ____  _____   ____  ___   __________"
  echo "   /   |  / __ \/ __ \/ ___/  / __ \/   | / ____/ ___/"
  echo "  / /| | / /_/ / / / /\__ \  / /_/ / /| |/ /    \__ \ "
  echo " / ___ |/ _, _/ /_/ /___/ / / ____/ ___ / /___ ___/ / "
  echo "/_/  |_/_/ |_|\____//____/ /_/   /_/  |_\____//____/  "
  echo -e "${NC}"
  echo -e "${BOLD}Medical PACS & Distributed Clinical Portal Suite${NC}"
  echo -e "${BLUE}======================================================${NC}"
  echo ""
}

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down background processes...${NC}"
  if [ -f "$PID_FILE" ]; then
    while read -r pid; do
      if ps -p "$pid" > /dev/null 2>&1; then
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE" "$NAMES_FILE"
  fi
  echo -e "${GREEN}✓ All application processes stopped.${NC}"
  echo -e "${CYAN}Note: Docker containers remain running in background.${NC}"
  echo -e "${CYAN}To stop Docker containers too, run: ./stop.sh${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Check prerequisites
check_prerequisites() {
  echo -e "${BOLD}🔍 Checking system prerequisites...${NC}"

  if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH.${NC}"
    exit 1
  fi

  if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed or not in PATH.${NC}"
    exit 1
  fi

  if ! command -v pnpm &> /dev/null && ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Neither pnpm nor npm found.${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Prerequisites verified.${NC}"
}

# Ensure Docker daemon is running
ensure_docker_running() {
  echo -e "${BOLD}🐳 Verifying Docker daemon...${NC}"
  if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}Docker is not running. Attempting to start Docker Desktop...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      open -a Docker || true
      echo -e "${CYAN}Waiting for Docker daemon to become responsive...${NC}"
      local count=0
      while ! docker info > /dev/null 2>&1; do
        sleep 2
        count=$((count + 2))
        echo -n "."
        if [ "$count" -ge 45 ]; then
          echo ""
          echo -e "${RED}❌ Timed out waiting for Docker. Please start Docker Desktop manually and retry.${NC}"
          exit 1
        fi
      done
      echo ""
      echo -e "${GREEN}✓ Docker daemon is active.${NC}"
    else
      echo -e "${RED}❌ Docker daemon is not active. Please start Docker and retry.${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✓ Docker daemon is active.${NC}"
  fi
}

# Start Docker infrastructure
start_infra() {
  echo ""
  echo -e "${BOLD}🚀 Starting Infrastructure (Orthanc PACS, PostgreSQL, Redis)...${NC}"
  docker compose -f docker-compose.infra.yml up -d --build

  echo -e "${CYAN}Waiting for services to be healthy...${NC}"
  
  # Wait for PostgreSQL
  local count=0
  until docker exec aros-orthanc-db pg_isready -U aros_user -d aros_clinic > /dev/null 2>&1; do
    sleep 1
    count=$((count + 1))
    if [ "$count" -ge 20 ]; then
      echo -e "${YELLOW}⚠️ Postgres is taking longer than usual to respond.${NC}"
      break
    fi
  done
  echo -e "${GREEN}✓ Orthanc PostgreSQL is ready.${NC}"

  # Wait for Redis
  count=0
  until docker exec aros-redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
    count=$((count + 1))
    if [ "$count" -ge 15 ]; then
      echo -e "${YELLOW}⚠️ Redis is taking longer than usual to respond.${NC}"
      break
    fi
  done
  echo -e "${GREEN}✓ Redis is ready.${NC}"

  # Wait for Orthanc
  count=0
  until curl -s http://localhost:8042/ > /dev/null 2>&1; do
    sleep 1
    count=$((count + 1))
    if [ "$count" -ge 20 ]; then
      echo -e "${YELLOW}⚠️ Orthanc PACS is starting up in background.${NC}"
      break
    fi
  done
  echo -e "${GREEN}✓ Orthanc PACS Server is ready.${NC}"
}

# Setup Python Backend Environments and Migrations
setup_backends() {
  echo ""
  echo -e "${BOLD}🐍 Preparing Python Backends...${NC}"

  # Core API venv
  if [ ! -d "apps/core-api/.venv" ]; then
    echo -e "${CYAN}Creating virtualenv for apps/core-api...${NC}"
    python3 -m venv apps/core-api/.venv
    apps/core-api/.venv/bin/pip install --upgrade pip
    apps/core-api/.venv/bin/pip install -r apps/core-api/requirements.txt
  fi

  # Clinic API venv
  if [ ! -d "apps/clinic-api/.venv" ]; then
    echo -e "${CYAN}Creating virtualenv for apps/clinic-api...${NC}"
    python3 -m venv apps/clinic-api/.venv
    apps/clinic-api/.venv/bin/pip install --upgrade pip
    apps/clinic-api/.venv/bin/pip install -r apps/clinic-api/requirements.txt
  fi

  # Run migrations
  echo -e "${CYAN}Applying database migrations for Core API...${NC}"
  apps/core-api/.venv/bin/python apps/core-api/manage.py migrate --noinput > "$LOGS_DIR/core-migrate.log" 2>&1
  echo -e "${GREEN}✓ Core API database migrated.${NC}"

  echo -e "${CYAN}Applying database migrations for Clinic API...${NC}"
  apps/clinic-api/.venv/bin/python apps/clinic-api/manage.py migrate --noinput > "$LOGS_DIR/clinic-migrate.log" 2>&1
  echo -e "${GREEN}✓ Clinic API database migrated.${NC}"
}

# Setup frontend dependencies if needed
setup_frontends() {
  echo ""
  echo -e "${BOLD}📦 Verifying Frontend Dependencies...${NC}"
  if [ ! -d "node_modules" ] || [ ! -d "apps/clinic-portal/node_modules" ]; then
    echo -e "${CYAN}Installing pnpm dependencies...${NC}"
    if command -v pnpm &> /dev/null; then
      pnpm install
    else
      npm install
    fi
  fi
  echo -e "${GREEN}✓ Frontend packages ready.${NC}"
}

# Register a started process PID
register_pid() {
  local pid="$1"
  local name="$2"
  echo "$pid" >> "$PID_FILE"
  echo "$pid:$name" >> "$NAMES_FILE"
}

# Start all applications
start_apps() {
  echo ""
  echo -e "${BOLD}⚡ Launching Applications & Portals...${NC}"
  rm -f "$PID_FILE" "$NAMES_FILE"

  # 1. Core API (ASGI/Daphne) on Port 8000
  echo -e "${CYAN}Starting Core API on http://localhost:8000 ...${NC}"
  (cd apps/core-api && .venv/bin/python -m daphne -v 2 --access-log - -b 0.0.0.0 -p 8000 arosPacs.asgi:application) > "$LOGS_DIR/core-api.log" 2>&1 &
  register_pid $! "Core-API"

  # 2. Clinic API (Django REST) on Port 8001
  echo -e "${CYAN}Starting Clinic API on http://localhost:8001 ...${NC}"
  (cd apps/clinic-api && .venv/bin/python manage.py runserver 0.0.0.0:8001) > "$LOGS_DIR/clinic-api.log" 2>&1 &
  register_pid $! "Clinic-API"

  # 3. DICOM Viewer (Static OHIF) on Port 3000
  echo -e "${CYAN}Starting DICOM Viewer on http://localhost:3000 ...${NC}"
  node scripts/serve-viewer.mjs > "$LOGS_DIR/dicom-viewer.log" 2>&1 &
  register_pid $! "DICOM-Viewer"

  # 4. Clinic Portal (Vite React) on Port 5173
  echo -e "${CYAN}Starting Clinic Portal on http://localhost:5173 ...${NC}"
  (cd apps/clinic-portal && npx vite --port 5173) > "$LOGS_DIR/clinic-portal.log" 2>&1 &
  register_pid $! "Clinic-Portal"

  # 5. Patient Portal (Vite React) on Port 5174
  echo -e "${CYAN}Starting Patient Portal on http://localhost:5174 ...${NC}"
  (cd apps/patient-portal && npx vite --port 5174) > "$LOGS_DIR/patient-portal.log" 2>&1 &
  register_pid $! "Patient-Portal"

  # 6. Physician Portal (Vite React) on Port 5175
  echo -e "${CYAN}Starting Physician Portal on http://localhost:5175 ...${NC}"
  (cd apps/physician-portal && npx vite --port 5175) > "$LOGS_DIR/physician-portal.log" 2>&1 &
  register_pid $! "Physician-Portal"

  # Allow 2 seconds for initial spinup
  sleep 2
}

# Print dashboard
show_dashboard() {
  echo ""
  echo -e "${GREEN}${BOLD}======================================================================${NC}"
  echo -e "${GREEN}${BOLD}  ✨ ALL AROS PACS SERVICES ARE RUNNING! ✨${NC}"
  echo -e "${GREEN}${BOLD}======================================================================${NC}"
  echo ""
  echo -e "${BOLD}🌐 FRONTEND PORTALS & VIEWERS:${NC}"
  echo -e "  • ${MAGENTA}Clinic Portal${NC}     : ${BOLD}http://localhost:5173${NC} (Recepción / Staff)"
  echo -e "  • ${MAGENTA}Patient Portal${NC}    : ${BOLD}http://localhost:5174${NC} (Portal de Pacientes)"
  echo -e "  • ${MAGENTA}Physician Portal${NC}  : ${BOLD}http://localhost:5175${NC} (Médicos Especialistas)"
  echo -e "  • ${MAGENTA}DICOM Viewer${NC}      : ${BOLD}http://localhost:3000${NC} (OHIF Web Viewer)"
  echo ""
  echo -e "${BOLD}⚙️ BACKEND & API GATEWAYS:${NC}"
  echo -e "  • ${BLUE}Core API (ASGI)${NC}   : ${BOLD}http://localhost:8000${NC} (Auth, Gateway, WS)"
  echo -e "  • ${BLUE}API Documentation${NC} : ${BOLD}http://localhost:8000/api/schema/swagger-ui/${NC}"
  echo -e "  • ${BLUE}Clinic API${NC}        : ${BOLD}http://localhost:8001${NC} (Clinical Data & Studies)"
  echo ""
  echo -e "${BOLD}🩻 PACS & INFRASTRUCTURE:${NC}"
  echo -e "  • ${CYAN}Orthanc PACS Web${NC}  : ${BOLD}http://localhost:8042${NC} (User: orthanc / Pass: orthanc)"
  echo -e "  • ${CYAN}Orthanc DICOM Port${NC}: ${BOLD}localhost:4242${NC} (AET: AROS_PACS)"
  echo -e "  • ${CYAN}Redis Service${NC}     : ${BOLD}localhost:6379${NC}"
  echo -e "  • ${CYAN}PostgreSQL DB${NC}     : ${BOLD}localhost:5432${NC} (DB: aros_clinic / User: aros_user)"
  echo ""
  echo -e "${YELLOW}📁 Service logs are streaming in: ${NC}${LOGS_DIR}/"
  echo -e "${YELLOW}⌨️  Press [Ctrl + C] anytime to stop all frontend and backend services.${NC}"
  echo -e "${GREEN}${BOLD}======================================================================${NC}"
  echo ""
}

# Monitoring loop
monitor_processes() {
  declare -A reported_dead
  while true; do
    if [ -f "$NAMES_FILE" ]; then
      while IFS=: read -r pid name; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
          if [ -z "${reported_dead[$pid]}" ]; then
            echo -e "${RED}⚠️ Service '${name}' (PID: $pid) stopped unexpectedly. Check logs in: ${LOGS_DIR}/${NC}"
            reported_dead[$pid]=1
          fi
        fi
      done < "$NAMES_FILE"
    fi
    sleep 3
  done
}

# Main Execution
print_banner
check_prerequisites
ensure_docker_running
start_infra
setup_backends
setup_frontends
start_apps
show_dashboard
monitor_processes
