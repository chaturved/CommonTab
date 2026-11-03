from __future__ import annotations

import re
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import Connection, Engine, create_engine, event, text

SCHEMA_NAME = re.compile(r'^[a-z_][a-z0-9_]{0,62}$')


def create_db_engine(url: str, schema: str | None = None) -> Engine:
    """
    Engine for the app or for tests. With `schema`, every connection works inside that schema
    (tests use a throwaway one), set per connection so it also works through Supabase's pooler.
    """
    engine = create_engine(url, pool_size=5, max_overflow=5, pool_pre_ping=True, connect_args={'connect_timeout': 15})
    if schema is not None:
        if not SCHEMA_NAME.match(schema):
            raise ValueError(f'Invalid schema name: {schema!r}')

        @event.listens_for(engine, 'connect')
        def set_search_path(dbapi_connection, _record):
            with dbapi_connection.cursor() as cursor:
                cursor.execute(f'SET search_path TO "{schema}"')
            dbapi_connection.commit()

    return engine


class Database:
    """Transaction boundary. Services open one transaction per request and hand the connection to repositories."""

    def __init__(self, engine: Engine):
        self.engine = engine

    @contextmanager
    def transaction(self) -> Iterator[Connection]:
        with self.engine.begin() as connection:
            yield connection

    def ping(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(text('SELECT 1'))
