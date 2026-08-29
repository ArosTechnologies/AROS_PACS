#!/usr/bin/env bash

# ==============================================================================
#  AROS PACS — Live Application Logs
#  Continuously tails the logs for all backend, frontend, and infra services.
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BOLD="\033[1m"
CYAN="\033[0;36m"
NC="\033[0m"

echo -e "${BOLD}${CYAN}📡 Initializing AROS PACS Live Logs Monitor...${NC}"
echo -e "Press [Ctrl+C] to exit the log viewer (applications will remain running in the background)."
echo "----------------------------------------------------------------------"

# Trap Ctrl-C to just exit the tail command gracefully
trap 'echo -e "\n${BOLD}Log viewer closed.${NC}"; exit 0' SIGINT SIGTERM

# We tail all local application logs in .logs/ AND the docker compose infra logs
# Using a background docker logs tail and foreground local tail
docker compose -f docker-compose.infra.yml logs -f --tail=50 &
DOCKER_PID=$!

if [ -d "$ROOT_DIR/.logs" ]; then
    tail -f "$ROOT_DIR"/.logs/*.log
else
    echo "No local logs found in .logs/ directory yet."
    wait $DOCKER_PID
fi

# In case tail -f exits (e.g. killed), kill the docker logs background job
kill $DOCKER_PID 2>/dev/null || true
