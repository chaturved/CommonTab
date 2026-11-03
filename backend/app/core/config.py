from __future__ import annotations

import os
from functools import lru_cache
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
    rate_limit_auth_per_minute: int = 10  # sign-up and sign-in, per IP
    rate_limit_per_minute: int = 600  # everything else, per session
    trust_proxy: bool = False  # read the client IP from X-Forwarded-For (only behind a proxy you control)
    bill_session_lifetime_seconds: int = 7 * 24 * 60 * 60


def load_settings(environ: dict[str, str] | None = None, dotenv: Path = ENV_FILE) -> Settings:
    env = {**read_dotenv(dotenv), **(os.environ if environ is None else environ)}
    url = env.get('DATABASE_URL', '').strip()
    if not url:
        raise RuntimeError('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.')
    defaults = Settings(database_url='')
    return Settings(
        database_url=normalize_database_url(url),
        metrics_token=env.get('SPLITTIP_METRICS_TOKEN') or None,
        rate_limit_auth_per_minute=int(env.get('RATE_LIMIT_AUTH_PER_MINUTE', defaults.rate_limit_auth_per_minute)),
        rate_limit_per_minute=int(env.get('RATE_LIMIT_PER_MINUTE', defaults.rate_limit_per_minute)),
        trust_proxy=env.get('TRUST_PROXY', '').lower() in ('1', 'true', 'yes'),
    )


@lru_cache
def get_settings() -> Settings:
    """The settings, read once from the environment. FastAPI dependency; tests override it."""
    return load_settings()
