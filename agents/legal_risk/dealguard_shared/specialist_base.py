"""Factory for the four specialist LlmAgents. Each agent directory stays an
independently deployable unit; this only removes prompt boilerplate duplication."""
import os

from google.adk.agents import LlmAgent

from .schemas import SpecialistReport

COMMON_RULES = """
You are one specialist on an M&A due-diligence deal team reviewing documents
about a potential acquisition. You are given the full text of ONE document.

STRICT RULES:
1. Only report findings inside your own domain (defined below). If the document
   contains nothing relevant to your domain, return document_relevant=false and
   an empty findings list. Never comment on other domains.
2. Every finding MUST include citation_quote: a short exact quote (10-40 words)
   copied VERBATIM, character-for-character, from the document text. Do not
   paraphrase inside citation_quote. Findings with unverifiable quotes are
   discarded by the system.
3. Name the recognized red-flag pattern each finding matches (red_flag_pattern)
   — a pattern a domain professional would recognize, not "this seems risky".
4. severity: high = could kill or materially re-price the deal; medium = needs
   resolution before close; low = worth tracking.
5. recommended_action must be one of: re-trade, escrow, indemnity, walk-away,
   monitor — the standard M&A resolution taxonomy. You suggest, a human decides.
6. suggested_followup_question: a concrete question the deal team would send the
   seller to clarify or resolve the finding.
7. entities: list the named entities (companies, people, patent numbers,
   contract names) each finding hinges on — used for cross-domain linking.
8. Report only what the document supports. Never invent facts, numbers, or
   clauses that are not in the text.
"""


def build_specialist(*, name: str, description: str, domain_instruction: str) -> LlmAgent:
    # Gemini 3.5 models are only served from the global endpoint on this project.
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "1")
    os.environ.setdefault("GOOGLE_CLOUD_LOCATION", os.environ.get("GEMINI_LOCATION", "global"))
    return LlmAgent(
        name=name,
        model=os.environ.get("GEMINI_MODEL", "gemini-3.5-flash"),
        description=description,
        instruction=COMMON_RULES + "\n" + domain_instruction,
        output_schema=SpecialistReport,
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )
