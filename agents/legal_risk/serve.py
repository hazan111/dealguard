"""A2A server entrypoint — runs this agent as an independent service."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dealguard_shared.config import load_dotenv

load_dotenv()

import uvicorn
from google.adk.a2a.utils.agent_to_a2a import to_a2a

from agent import root_agent

PORT = int(os.environ.get("PORT", "8101"))
app = to_a2a(root_agent, port=PORT)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
