"""Deploys this agent to Vertex AI Agent Engine (ARCHITECTURE §5).

Run from the agent's own directory: ../../.venv/bin/python deploy.py
The shared package is vendored in first (see repo-root deploy.sh pattern).
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__))
SHARED_SRC = os.path.join(HERE, "..", "..", "shared", "dealguard_shared")
SHARED_DST = os.path.join(HERE, "dealguard_shared")
if os.path.isdir(SHARED_SRC):
    shutil.rmtree(SHARED_DST, ignore_errors=True)
    shutil.copytree(SHARED_SRC, SHARED_DST)

from dealguard_shared.config import load_dotenv

load_dotenv()

import vertexai
from vertexai import agent_engines
from vertexai.agent_engines import AdkApp

from agent import root_agent

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
vertexai.init(project=PROJECT, location="us-central1",
              staging_bucket=f"gs://{PROJECT}-dealguard")

AGENT_NAME = os.path.basename(HERE)

env_vars = {  # GOOGLE_CLOUD_PROJECT is reserved — Agent Engine sets it itself
    "GEMINI_LOCATION": "global",
    "GEMINI_MODEL": os.environ.get("GEMINI_MODEL", "gemini-3.5-flash"),
    "FIRESTORE_DATABASE": os.environ.get("FIRESTORE_DATABASE", "dealguard"),
}
# The orchestrator needs the specialists' addresses at runtime.
for key in ("LEGAL_AGENT_A2A_URL", "FINANCIAL_AGENT_A2A_URL",
            "HR_AGENT_A2A_URL", "IP_AGENT_A2A_URL", "SPECIALIST_TIMEOUT_S"):
    if os.environ.get(key):
        env_vars[key] = os.environ[key]

remote_agent = agent_engines.create(
    AdkApp(agent=root_agent),
    requirements=[
        "google-cloud-aiplatform[adk,agent_engines]",
        "google-adk[a2a]",
        "google-cloud-firestore",
        "httpx",
        "sse-starlette",
    ],
    extra_packages=["agent.py", "dealguard_shared"] + (
        ["pipeline.py", "a2a_client.py"] if AGENT_NAME == "orchestrator" else []),
    display_name=f"dealguard-{AGENT_NAME.replace('_', '-')}",
    description=root_agent.description,
    env_vars=env_vars,
)
print(remote_agent.resource_name)
