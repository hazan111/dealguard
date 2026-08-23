"""Resets the demo state: wipes all DealGuard Firestore collections so the
demo narrative can be re-run from a clean slate (TASKLIST Phase 2).

Usage: .venv/bin/python scenario/reset_deal.py [--yes]
"""
import sys

from dealguard_shared.config import load_dotenv

load_dotenv()

from dealguard_shared import firestore_client as store

COLLECTIONS = ["documents", "risk_findings", "deal_timeline", "dead_letter",
               "daily_briefings", "deal_memory"]

if "--yes" not in sys.argv:
    answer = input(f"Wipe {', '.join(COLLECTIONS)} in database "
                   f"'{store.config.firestore_database}'? [y/N] ")
    if answer.strip().lower() != "y":
        sys.exit("aborted")

for name in COLLECTIONS:
    count = 0
    for snap in store.db().collection(name).stream():
        snap.reference.delete()
        count += 1
    print(f"{name}: deleted {count}")
print("reset complete")
