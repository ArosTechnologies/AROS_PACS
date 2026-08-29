#!/usr/bin/env bash

# ==============================================================================
#  AROS PACS — Status & Health Check Script
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

echo -e "${BOLD}🩺 AROS PACS Services Status Check:${NC}"
echo "----------------------------------------------------------------------"

check_http() {
  local name="$1"
  local url="$2"
  local auth_args="$3"

  local code
  if [ -n "$auth_args" ]; then
    code=$(curl -s -u "$auth_args" -o /dev/null -w "%{http_code}" "$url" --max-time 2 2>/dev/null || echo "DOWN")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 2 2>/dev/null || echo "DOWN")
  fi

  if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ] || [ "$code" = "307" ] || [ "$code" = "401" ]; then
    printf "  [ ${GREEN}ONLINE${NC} ]  %-18s -> %-36s (HTTP %s)\n" "$name" "$url" "$code"
  else
    printf "  [ ${RED}OFFLINE${NC} ] %-18s -> %-36s (Status: %s)\n" "$name" "$url" "$code"
  fi
}

check_port() {
  local name="$1"
  local port="$2"

  if nc -z localhost "$port" 2>/dev/null; then
    printf "  [ ${GREEN}ONLINE${NC} ]  %-18s -> Port :%-30s\n" "$name" "$port"
  else
    printf "  [ ${RED}OFFLINE${NC} ] %-18s -> Port :%-30s\n" "$name" "$port"
  fi
}

# Frontend Portals
echo -e "${BOLD}Frontends:${NC}"
check_http "Clinic Portal" "http://localhost:5173"
check_http "Patient Portal" "http://localhost:5174"
check_http "Physician Portal" "http://localhost:5175"
check_http "DICOM Viewer" "http://localhost:3000"

# Backend APIs
echo ""
echo -e "${BOLD}Backends:${NC}"
check_http "Core API" "http://localhost:8000/health/"
check_http "Clinic API" "http://localhost:8001/health/"

# PACS & Infra
echo ""
echo -e "${BOLD}PACS & Infrastructure:${NC}"
check_http "Orthanc Web" "http://localhost:8042" "orthanc:orthanc"
check_port "Orthanc DICOM" "4242"
check_port "Redis" "6379"
check_port "PostgreSQL" "5432"

echo "----------------------------------------------------------------------"
