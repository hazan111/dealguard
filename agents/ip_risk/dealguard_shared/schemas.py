"""Structured output schemas shared by all agents. Pydantic models double as
ADK output schemas and as validation at the orchestrator boundary."""
from typing import Literal, Optional
from pydantic import BaseModel, Field

Domain = Literal["legal", "financial", "hr", "ip"]
Severity = Literal["low", "medium", "high"]
RecommendedAction = Literal["re-trade", "escrow", "indemnity", "walk-away", "monitor"]


class Finding(BaseModel):
    """One risk finding produced by a specialist agent."""
    domain: Domain
    summary: str = Field(description="Human-readable finding, 1-3 sentences, naming the recognized red-flag pattern it matches.")
    red_flag_pattern: str = Field(description="The recognized due-diligence red-flag pattern this matches, e.g. 'change-of-control termination right', 'customer concentration above the 20-25% threshold', 'unassigned founder IP', 'golden parachute / key-person dependency'.")
    citation_ref: str = Field(description="Where in the source document, e.g. 'Section 8.2' or 'p.3, Customer Concentration table'.")
    citation_quote: str = Field(description="A short EXACT quote (10-40 words) copied verbatim from the source document that supports this finding. Must appear word-for-word in the document.")
    severity: Severity
    recommended_action: RecommendedAction
    suggested_followup_question: Optional[str] = Field(default=None, description="A question the deal team would send the seller to clarify or resolve this finding.")
    entities: list[str] = Field(default_factory=list, description="Named entities this finding hinges on (customer names, person names, patent numbers) — used for cross-referencing.")


class SpecialistReport(BaseModel):
    """What a specialist agent returns for one document."""
    document_relevant: bool = Field(description="False if the document contains nothing relevant to this specialist's domain.")
    findings: list[Finding] = Field(default_factory=list)


class Classification(BaseModel):
    category: Literal["legal", "financial", "hr", "ip", "unclassified"]
    reason: str
