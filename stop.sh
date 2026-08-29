#!/usr/bin/env bash

# ==============================================================================
#  AROS PACS — Stop Script
#  Stops all running backend, frontend, and Docker infrastructure services.
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PID_FILE="$ROOT_DIR/.pids"

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${YELLOW}${BOLD}🛑 Stopping all AROS PACS services...${NC}"

# Stop background node / python processes
if [ -f "$PID_FILE" ]; then
  echo -e "${YELLOW}Stopping application processes...${NC}"
  while read -r pid; do
    if ps -p "$pid" > /dev/null 2>&1; then
      kill "$pid" 2>/dev/null || true
      echo "  • Killed PID $pid"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# Fallback: kill any leftover listeners on ports 8000, 8001, 3000, 5173, 5174, 5175
for port in 8000 8001 3000 5173 5174 5175; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  • Freeing port :$port (PID $pids)"
    kill -9 $pids 2>/dev/null || true
  fi
done

# Stop Docker infrastructure
if command -v docker &> /dev/null && docker info > /dev/null 2>&1; then
  echo -e "${YELLOW}Stopping Docker containers...${NC}"
  docker compose -f docker-compose.infra.yml down
fi

echo -e "${GREEN}${BOLD}✓ All AROS PACS services and containers stopped successfully.${NC}"
