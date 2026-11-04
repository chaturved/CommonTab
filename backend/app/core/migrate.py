from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection

ALEMBIC_INI = Path(__file__).resolve().parents[2] / 'alembic.ini'


def alembic_config(connection: Connection | None = None) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option('script_location', str(ALEMBIC_INI.parent / 'migrations'))
    if connection is not None:
        config.attributes['connection'] = connection
        config.attributes['configure_logging'] = False
    return config


def upgrade(connection: Connection, revision: str = 'head') -> None:
    command.upgrade(alembic_config(connection), revision)


def downgrade(connection: Connection, revision: str) -> None:
    command.downgrade(alembic_config(connection), revision)
