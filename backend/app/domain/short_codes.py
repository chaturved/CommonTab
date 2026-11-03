from __future__ import annotations

import secrets

ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
CODE_LENGTH = 8
LOOKALIKES = str.maketrans({'O': '0', 'I': '1', 'L': '1'})


def new_code() -> str:
    return ''.join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def display_code(code: str) -> str:
    return f'{code[:4]}-{code[4:]}'


def normalize_code(raw: str) -> str | None:
    code = ''.join(raw.split()).replace('-', '').upper().translate(LOOKALIKES)
    if len(code) != CODE_LENGTH or any(char not in ALPHABET for char in code):
        return None
    return code
