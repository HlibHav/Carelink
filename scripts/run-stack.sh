#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Function to check if port is in use
check_port() {
  local port=$1
  if lsof -ti:$port >/dev/null 2>&1; then
    return 0  # Port is in use
  else
    return 1  # Port is free
  fi
}

# Function to kill process on port
kill_port() {
  local port=$1
  local pids=$(lsof -ti:$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "🛑 Killing process on port $port (PIDs: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check for ports that might be in use
PORTS_TO_CHECK=(4300 4101 4102 4103 4200 4201 4202 8080 5173)
OCCUPIED_PORTS=()
for port in "${PORTS_TO_CHECK[@]}"; do
  if check_port "$port"; then
    OCCUPIED_PORTS+=($port)
  fi
done

if [ ${#OCCUPIED_PORTS[@]} -gt 0 ]; then
  echo "⚠️  Warning: The following ports are already in use:"
  for port in "${OCCUPIED_PORTS[@]}"; do
    pids=$(lsof -ti:$port 2>/dev/null | tr '\n' ' ')
    echo "   • Port $port (PIDs: $pids)"
  done
  echo ""
  read -p "Do you want to kill these processes and continue? (y/N): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for port in "${OCCUPIED_PORTS[@]}"; do
      kill_port "$port"
    done
    echo "✅ Ports cleared"
    sleep 2
  else
    echo "❌ Aborting. Please stop the processes manually and try again."
    exit 1
  fi
fi

# Start Weaviate via Docker Compose
echo "🚀 Starting Weaviate..."
cd "$ROOT_DIR"
if docker-compose -f docker-compose.weaviate.yml ps | grep -q "Up"; then
  echo "✅ Weaviate is already running"
else
  docker-compose -f docker-compose.weaviate.yml up -d
  echo "⏳ Waiting for Weaviate to be ready..."
  
  # Wait for Weaviate to be ready (max 30 seconds)
  for i in {1..30}; do
    if curl -s http://localhost:8082/v1/.well-known/ready >/dev/null 2>&1; then
      echo "✅ Weaviate is ready"
      break
    fi
    if [ $i -eq 30 ]; then
      echo "⚠️  Weaviate did not become ready in time, but continuing..."
    else
      sleep 1
    fi
  done
fi

# Function to wait for a service to be ready
wait_for_service() {
  local name=$1
  local url=$2
  local max_attempts=${3:-30}
  
  echo "⏳ Waiting for $name to be ready..."
  for i in $(seq 1 $max_attempts); do
    if curl -s "$url" >/dev/null 2>&1; then
      echo "✅ $name is ready"
      return 0
    fi
    if [ $i -eq $max_attempts ]; then
      echo "⚠️  $name did not become ready in time, but continuing..."
      return 1
    fi
    sleep 1
  done
}

# Services to start (in order with dependencies)
# Phase 1: Infrastructure (no dependencies)
echo "📦 Phase 1: Starting infrastructure services..."
SERVICES_PHASE1=(
  "Event Bus;services/event-bus;npm run dev;http://localhost:4300/healthz"
)

# Phase 2: Engines (depend on Event Bus)
echo "📦 Phase 2: Starting engines..."
SERVICES_PHASE2=(
  "Physical Engine;engines/physical;npm run dev;http://localhost:4101/healthz"
  "Mind & Behavior Engine;engines/mind-behavior;npm run dev;http://localhost:4102/healthz"
)

# Phase 3: Memory Manager (depends on Weaviate, Firestore)
echo "📦 Phase 3: Starting Memory Manager..."
SERVICES_PHASE3=(
  "Memory Manager;services/memory-manager;npm run dev;http://localhost:4103/healthz"
)

# Phase 4: Agents (depend on Event Bus, Memory Manager)
echo "📦 Phase 4: Starting agents..."
SERVICES_PHASE4=(
  "Dialogue Agent;agents/dialogue;npm run dev;http://localhost:4200/healthz"
  "Coach Agent;agents/coach;npm run dev;http://localhost:4201/healthz"
  "Safety Agent;agents/safety;npm run dev;http://localhost:4202/healthz"
)

# Phase 5: Gateway (depends on Dialogue Agent and other services)
echo "📦 Phase 5: Starting Gateway..."
SERVICES_PHASE5=(
  "Gateway;apps/gateway;npm run dev;http://localhost:8080/healthz"
)

# Phase 6: Frontend (depends on Gateway)
echo "📦 Phase 6: Starting Frontend..."
SERVICES_PHASE6=(
  "Frontend;frontend;npm run dev;http://localhost:5173"
)

PIDS=()

cleanup() {
  echo ""
  echo "🛑 Shutting down stack..."
  
  # Stop Node.js services
  if ((${#PIDS[@]})); then
    for pid in "${PIDS[@]}"; do
      kill "$pid" >/dev/null 2>&1 || true
    done
  fi
  
  # Optionally stop Weaviate (commented out by default)
  # Uncomment the next line if you want to stop Weaviate when stopping the stack
  # docker-compose -f docker-compose.weaviate.yml down
  
  echo "✅ Stack stopped"
}

trap cleanup INT TERM EXIT

# Function to ensure dependencies are installed
ensure_dependencies() {
  local path=$1
  
  if [ ! -d "$ROOT_DIR/$path/node_modules" ]; then
    echo "📦 Installing dependencies for $path..."
    (cd "$ROOT_DIR/$path" && npm install --silent)
  fi
}

# Function to start a service (without waiting)
start_service_background() {
  local name=$1
  local path=$2
  local cmd=$3
  
  # Ensure dependencies are installed
  ensure_dependencies "$path"
  
  (
    cd "$ROOT_DIR/$path"
    exec bash -lc "$cmd" 2>&1
  ) | while IFS= read -r line || [[ -n "$line" ]]; do
    printf '[%s] %s\n' "$name" "$line"
  done 2>/dev/null &
  PIDS+=($!)
  echo "✅ Started $name (PID: $!)"
}

# Function to start a service and wait for it to be ready
start_service() {
  local name=$1
  local path=$2
  local cmd=$3
  local health_url=$4
  
  # Ensure dependencies are installed
  ensure_dependencies "$path"
  
  start_service_background "$name" "$path" "$cmd"
  
  # Wait for service to be ready if health URL provided
  if [ -n "$health_url" ]; then
    wait_for_service "$name" "$health_url" 30
  else
    sleep 2  # Default delay if no health check
  fi
}

# Start services in phases
echo ""
echo "🚀 Starting services in phases..."
echo ""

# Phase 1: Infrastructure
for svc in "${SERVICES_PHASE1[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  start_service "$name" "$path" "$cmd" "$health_url"
done

# Phase 2: Engines (can start in parallel)
for svc in "${SERVICES_PHASE2[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  start_service_background "$name" "$path" "$cmd"
done
# Wait for all engines to be ready
for svc in "${SERVICES_PHASE2[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  if [ -n "$health_url" ]; then
    wait_for_service "$name" "$health_url" 30
  else
    sleep 2
  fi
done

# Phase 3: Memory Manager
for svc in "${SERVICES_PHASE3[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  start_service "$name" "$path" "$cmd" "$health_url"
done

# Phase 4: Agents (can start in parallel after Memory Manager is ready)
for svc in "${SERVICES_PHASE4[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  start_service_background "$name" "$path" "$cmd"
done
# Wait for all agents to be ready
for svc in "${SERVICES_PHASE4[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  if [ -n "$health_url" ]; then
    wait_for_service "$name" "$health_url" 30
  else
    sleep 2
  fi
done

# Phase 5: Gateway
for svc in "${SERVICES_PHASE5[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  start_service "$name" "$path" "$cmd" "$health_url"
done

# Phase 6: Frontend
for svc in "${SERVICES_PHASE6[@]}"; do
  IFS=';' read -r name path cmd health_url <<<"$svc"
  start_service "$name" "$path" "$cmd" "$health_url"
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🚀 CareLink stack is running!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Services:"
echo "   • Weaviate: http://localhost:8082"
echo "   • Event Bus: http://localhost:4300"
echo "   • Physical Engine: http://localhost:4101"
echo "   • Mind & Behavior Engine: http://localhost:4102"
echo "   • Memory Manager: http://localhost:4103"
echo "   • Dialogue Agent: http://localhost:4200"
echo "   • Coach Agent: http://localhost:4201"
echo "   • Safety Agent: http://localhost:4202"
echo "   • Gateway: http://localhost:8080"
echo "   • Frontend: http://localhost:5173"
echo ""
echo "🌐 Weaviate Console: https://console.semi.technology"
echo "   (Connect to: http://localhost:8082)"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for any service to exit (compatible with older bash)
# Use a simple polling loop instead of wait -n
while true; do
  # Check if any service has exited
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo ""
      echo "⚠️  A service exited (PID: $pid). Cleaning up..."
      cleanup
      exit 1
    fi
  done
  sleep 2
done
