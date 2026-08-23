"""Citation verification — the concrete hallucination-recovery mechanism
(ARCHITECTURE §2a): a finding whose quoted passage is not actually in the
source document is never accepted as confirmed."""
import re

MIN_QUOTE_WORDS = 4  # an empty/near-empty quote must never auto-verify


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[‘’“”]", "'", text)
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def citation_verified(quote: str, document_text: str) -> bool:
    q = _normalize(quote or "")
    if len(q.split()) < MIN_QUOTE_WORDS:
        return False
    return q in _normalize(document_text or "")
