#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SERVICES=(
  "Event Bus;services/event-bus;npm run dev"
  "Physical Engine;engines/physical;npm run dev"
  "Mind & Behavior Engine;engines/mind-behavior;npm run dev"
  "Memory Manager;services/memory-manager;npm run dev"
  "Dialogue Agent;agents/dialogue;npm run dev"
  "Coach Agent;agents/coach;npm run dev"
  "Safety Agent;agents/safety;npm run dev"
  "Gateway;apps/gateway;npm run dev"
  "Frontend;frontend;npm run dev"
)

PIDS=()

cleanup() {
  if ((${#PIDS[@]})); then
    echo "Shutting down stack..."
    for pid in "${PIDS[@]}"; do
      kill "$pid" >/dev/null 2>&1 || true
    done
  fi
}

trap cleanup INT TERM EXIT

for svc in "${SERVICES[@]}"; do
  IFS=';' read -r name path cmd <<<"$svc"
  (
    cd "$ROOT_DIR/$path"
    exec bash -lc "$cmd"
  ) | while IFS= read -r line || [[ -n "$line" ]]; do
    printf '[%s] %s\n' "$name" "$line"
  done &
  PIDS+=($!)
  echo "Started $name"
done

echo "CareLink stack is running. Press Ctrl+C to stop."

wait -n || true
echo "A service exited. Cleaning up..."
