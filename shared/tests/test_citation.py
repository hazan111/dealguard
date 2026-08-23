from dealguard_shared.citation import citation_verified

DOC = """Section 8.2 — Change of Control. Upon any Change of Control of the
Company, Meridian Fulfillment Corp. may terminate this Agreement upon thirty
(30) days' written notice, without penalty."""


def test_exact_quote_verifies():
    assert citation_verified("Meridian Fulfillment Corp. may terminate this Agreement", DOC)


def test_quote_with_different_case_and_punctuation_verifies():
    assert citation_verified("meridian fulfillment corp may terminate this agreement", DOC)


def test_fabricated_quote_fails():
    assert not citation_verified("the Company shall indemnify Buyer for all losses", DOC)


def test_mutated_quote_fails():
    # one changed word — must not verify
    assert not citation_verified("Meridian Fulfillment Corp. may renew this Agreement", DOC)


def test_empty_and_tiny_quotes_fail():
    assert not citation_verified("", DOC)
    assert not citation_verified("the", DOC)
    assert not citation_verified("may terminate this", DOC)  # 3 words < minimum
