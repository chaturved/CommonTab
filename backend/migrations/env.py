from __future__ import annotations

from logging.config import fileConfig

from alembic import context

from app.core.config import load_settings
from app.core.db import create_db_engine

config = context.config
if config.config_file_name is not None and config.attributes.get('configure_logging', True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# No ORM models: migrations are written by hand and are the schema's source of truth.
target_metadata = None


def run_migrations_online() -> None:
    # Tests hand in a connection that is already inside a throwaway schema.
    connection = config.attributes.get('connection')
    if connection is not None:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_db_engine(load_settings().database_url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations_online()
