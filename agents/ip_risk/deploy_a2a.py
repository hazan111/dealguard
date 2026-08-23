"""Deploys this agent to Agent Engine with the platform-native A2A template
(vertexai.preview.reasoning_engines.A2aAgent): the agent speaks the A2A
protocol on Agent Engine itself, with a Firestore-backed task store (Agent
Engine replicas are ephemeral — in-memory task state does not survive between
send and poll; verified live) and its own dedicated service account (per-agent
identity; zero-trust: only the orchestrator's identity can touch the risk
register database).
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
from vertexai.preview.reasoning_engines import A2aAgent

from a2a.types import AgentCapabilities, AgentCard, TransportProtocol

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
vertexai.init(project=PROJECT, location="us-central1",
              staging_bucket=f"gs://{PROJECT}-dealguard")

AGENT_NAME = "ip_risk"
SERVICE_ACCOUNT = "dealguard-ip@" + PROJECT + ".iam.gserviceaccount.com"


def agent_executor_builder(**kwargs):
    """Runs inside the Agent Engine container."""
    from google.adk.a2a.executor.a2a_agent_executor import A2aAgentExecutor
    from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService
    from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
    from google.adk.runners import Runner
    from google.adk.sessions.in_memory_session_service import InMemorySessionService

    from agent import root_agent

    async def _build_runner():
        return Runner(
            app_name=root_agent.name,
            agent=root_agent,
            session_service=InMemorySessionService(),
            artifact_service=InMemoryArtifactService(),
            memory_service=InMemoryMemoryService(),
        )

    return A2aAgentExecutor(runner=_build_runner)


def task_store_builder(**kwargs):
    """Firestore-backed A2A task store (replica-safe)."""
    import os as _os
    from dealguard_shared.firestore_task_store import FirestoreTaskStore
    return FirestoreTaskStore(
        project=_os.environ["GOOGLE_CLOUD_PROJECT"],
        database=_os.environ.get("A2A_TASKS_DATABASE", "dealguard-a2a"),
    )


card = AgentCard(
    name="ip_risk_agent",
    description='M&A IP due-diligence specialist: assignment gaps, ownership chains, licensing risk.',
    url="https://us-central1-aiplatform.googleapis.com/",  # canonical endpoint known post-deploy
    version="0.1.0",
    preferred_transport=TransportProtocol.http_json,
    capabilities=AgentCapabilities(streaming=False),
    default_input_modes=["text/plain"],
    default_output_modes=["text/plain"],
    skills=[],
)

env_vars = {
    "GEMINI_LOCATION": "global",
    "GEMINI_MODEL": os.environ.get("GEMINI_MODEL", "gemini-3.5-flash"),
    "FIRESTORE_DATABASE": os.environ.get("FIRESTORE_DATABASE", "dealguard"),
    "A2A_TASKS_DATABASE": "dealguard-a2a",
}
for key in ("LEGAL_AGENT_A2A_URL", "FINANCIAL_AGENT_A2A_URL",
            "HR_AGENT_A2A_URL", "IP_AGENT_A2A_URL", "SPECIALIST_TIMEOUT_S"):
    if os.environ.get(key):
        env_vars[key] = os.environ[key]

_existing = os.environ.get("DEALGUARD_UPDATE_ENGINE", "")
_op = (lambda **kw: agent_engines.update(_existing, **kw)) if _existing else agent_engines.create
remote_agent = _op(
    agent_engine=A2aAgent(agent_card=card,
             agent_executor_builder=agent_executor_builder,
             task_store_builder=task_store_builder),
    requirements=[
        "google-cloud-aiplatform[adk,agent_engines]",
        "google-adk[a2a]",
        "a2a-sdk==0.3.4",
        "google-cloud-firestore",
        "httpx",
        "sse-starlette",
    ],
    extra_packages=['agent.py', 'dealguard_shared'],
    gcs_dir_name="agent_engine_" + AGENT_NAME,  # parallel deploys clobber the default shared staging path
    display_name="dealguard-" + AGENT_NAME.replace("_", "-"),
    description=card.description,
    env_vars=env_vars,
    service_account=SERVICE_ACCOUNT,
)
print(remote_agent.resource_name)
