#!/usr/bin/env bash
# DealGuard demo helper.
#
#   ./scripts/demo.sh local   — full-local fleet: 5 A2A agents + gateway + dashboard API + frontend
#   ./scripts/demo.sh cloud   — frontend against the CLOUD stack (agents on Agent Engine,
#                               gateway/watcher/API on Cloud Run); also re-arms the Drive
#                               watch channel (channels expire ~1h — run this before demoing)
#   ./scripts/demo.sh reset   — wipe Firestore demo state (asks for confirmation)
#   ./scripts/demo.sh stop    — stop all local processes
set -euo pipefail
cd "$(dirname "$0")/.."

WATCHER_URL=https://dealguard-drivewatcher-894106893022.us-central1.run.app
DASH_URL=https://dealguard-dashboardbackend-894106893022.us-central1.run.app

case "${1:-}" in
  local)
    for A in orchestrator legal_risk financial_risk hr_risk ip_risk; do
      (nohup .venv/bin/python agents/$A/serve.py > /tmp/dg_$A.log 2>&1 &)
    done
    (nohup .venv/bin/uvicorn main:app --app-dir gateway --port 8080 > /tmp/dg_gateway.log 2>&1 &)
    (nohup .venv/bin/uvicorn main:app --app-dir dashboard-backend --port 8085 > /tmp/dg_dashapi.log 2>&1 &)
    sleep 5
    (cd dashboard-frontend && VITE_API_URL=http://127.0.0.1:8085 npm run dev)
    ;;
  cloud)
    TOK=$(grep DRIVE_WATCH_CHANNEL_TOKEN .env | cut -d= -f2)
    echo "Re-arming Drive watch channel..."
    curl -s -X POST "$WATCHER_URL/watch/renew" -H "X-DealGuard-Token: $TOK" | head -c 200; echo
    (cd dashboard-frontend && VITE_API_URL=$DASH_URL npm run dev)
    ;;
  reset)
    .venv/bin/python scenario/reset_deal.py
    ;;
  stop)
    pkill -f "agents/.*/serve.py" || true
    pkill -f "uvicorn main:app" || true
    echo "stopped"
    ;;
  *)
    echo "usage: $0 local|cloud|reset|stop"; exit 1;;
esac
