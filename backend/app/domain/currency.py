from __future__ import annotations

import re

ZERO_DECIMAL = {'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'}
THREE_DECIMAL = {'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'}
RATE_SCALE = 1_000_000


def fraction_digits(code: str) -> int | None:
    if not re.fullmatch(r'[A-Z]{3}', code):
        return None
    if code in ZERO_DECIMAL:
        return 0
    return 3 if code in THREE_DECIMAL else 2


def convert_minor(original: int, source: str, target: str, rate_micros: int) -> int:
    source_digits, target_digits = fraction_digits(source), fraction_digits(target)
    if source_digits is None or target_digits is None:
        raise ValueError('Unknown currency')
    numerator = original * rate_micros * 10 ** target_digits
    denominator = RATE_SCALE * 10 ** source_digits
    converted = (2 * numerator + denominator) // (2 * denominator)
    if converted < 1:
        raise ValueError('The amount is too small to convert')
    return converted
