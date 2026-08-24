#!/usr/bin/env bash
# Post-submission teardown. Run AFTER the demo video and console proof are recorded.
#
# Devpost (25 Aug 2026) confirmed the project does not need to stay live for
# judging — a screen recording of the Cloud Console plus the repo is enough.
# Agent Engine bills per vCPU/GB-second of active runtime and Cloud Run scales
# to zero, so the standing cost is small; this exists to take it to zero.
#
#   ./scripts/shutdown.sh list      what would be removed
#   ./scripts/shutdown.sh agents    delete the five Agent Engine deployments
#   ./scripts/shutdown.sh run       delete the three DealGuard Cloud Run services
#
# Firestore data, the Drive data room and the repo are never touched: they are
# the evidence. Redeploy with README §8 when needed.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=gen-lang-client-0930125328
REGION=us-central1
RUN_SERVICES=(dealguard-gateway dealguard-drivewatcher dealguard-dashboardbackend)

case "${1:-list}" in
  list)
    echo "Agent Engines:"
    .venv/bin/python - <<'PY'
import vertexai
from vertexai import agent_engines
vertexai.init(project="gen-lang-client-0930125328", location="us-central1")
for e in agent_engines.list():
    print("  -", e.display_name, e.resource_name.split("/")[-1])
PY
    echo "Cloud Run (DealGuard only):"
    for s in "${RUN_SERVICES[@]}"; do echo "  - $s"; done
    echo
    echo "Left alone: Firestore, Drive data room, GCS briefings, repo,"
    echo "and every non-DealGuard Cloud Run service on this project."
    ;;
  agents)
    .venv/bin/python - <<'PY'
import vertexai
from vertexai import agent_engines
vertexai.init(project="gen-lang-client-0930125328", location="us-central1")
for e in agent_engines.list():
    print("deleting", e.display_name)
    agent_engines.delete(e.resource_name, force=True)
print("agent engines removed")
PY
    ;;
  run)
    for s in "${RUN_SERVICES[@]}"; do
      gcloud run services delete "$s" --region="$REGION" --project="$PROJECT" --quiet
    done
    ;;
  *)
    echo "usage: $0 list|agents|run"; exit 1;;
esac
