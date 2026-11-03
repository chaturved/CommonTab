from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[2] / '.env'


def read_dotenv(path: Path = ENV_FILE) -> dict[str, str]:
    """Minimal KEY=VALUE reader for local development. Real environment variables win over the file."""
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"\'')
    return values


def normalize_database_url(url: str) -> str:
    """Use the psycopg 3 driver for plain postgres:// and postgresql:// URLs."""
    for prefix in ('postgresql://', 'postgres://'):
        if url.startswith(prefix):
            return 'postgresql+psycopg://' + url[len(prefix):]
    return url


@dataclass(frozen=True)
class Settings:
    database_url: str
    metrics_token: str | None = None


def load_settings(environ: dict[str, str] | None = None, dotenv: Path = ENV_FILE) -> Settings:
    env = {**read_dotenv(dotenv), **(os.environ if environ is None else environ)}
    url = env.get('DATABASE_URL', '').strip()
    if not url:
        raise RuntimeError('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.')
    return Settings(database_url=normalize_database_url(url), metrics_token=env.get('SPLITTIP_METRICS_TOKEN') or None)
