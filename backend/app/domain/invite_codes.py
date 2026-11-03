from __future__ import annotations

import secrets

from app.core.errors import fail

# Crockford base32: no I, L, O or U, so a code read aloud or typed from a screenshot is hard to get wrong.
ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
CODE_LENGTH = 8  # 32^8 is about 10^12 codes
LOOKALIKES = str.maketrans({'O': '0', 'I': '1', 'L': '1'})


def new_code() -> str:
    return ''.join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def display_code(code: str) -> str:
    """ABCD-EFGH: easier to read out and to type."""
    return f'{code[:4]}-{code[4:]}'


def normalize_code(raw: str) -> str:
    """What the person typed -> the stored form. Anything that cannot be a code is treated like an unknown code."""
    code = ''.join(raw.split()).replace('-', '').upper().translate(LOOKALIKES)
    if len(code) != CODE_LENGTH or any(char not in ALPHABET for char in code):
        fail(404, 'Invitation missing or expired')
    return code
