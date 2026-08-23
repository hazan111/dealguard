#!/usr/bin/env bash
# Deploys a Cloud Run service, vendoring the shared package into its build context.
# Usage: ./deploy.sh gateway|dashboard-backend|drive-watcher
set -euo pipefail
SVC="$1"
rsync -a --delete shared/dealguard_shared/ "$SVC/dealguard_shared/"
gcloud run deploy "dealguard-${SVC//-/}" \
  --source="./$SVC" --region=us-central1 \
  --service-account="dealguard-runtime@gen-lang-client-0930125328.iam.gserviceaccount.com" \
  --allow-unauthenticated --quiet
