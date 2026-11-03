from __future__ import annotations

import re
from contextlib import contextmanager
from functools import lru_cache
from typing import Iterator

from fastapi import Depends
from sqlalchemy import Connection, Engine, create_engine, event, text

from app.core.config import get_settings

SCHEMA_NAME = re.compile(r'^[a-z_][a-z0-9_]{0,62}$')


def create_db_engine(url: str, schema: str | None = None, pre_ping: bool = True) -> Engine:
    """
    Engine for the app or for tests. With `schema`, every connection works inside that schema
    (tests use a throwaway one), set per connection so it also works through Supabase's pooler.
    `pre_ping` checks a pooled connection before use (one extra round trip); tests turn it off.
    """
    engine = create_engine(url, pool_size=5, max_overflow=5, pool_pre_ping=pre_ping, connect_args={'connect_timeout': 15})
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


@lru_cache
def get_database() -> Database:
    """The one Database, created on first use. FastAPI dependency; tests override it."""
    return Database(create_db_engine(get_settings().database_url))


def get_db(database: Database = Depends(get_database)) -> Iterator[Connection]:
    """
    A connection inside one transaction: committed when the request handler returns, rolled back if it raises.
    Used as `Depends(get_db, scope='function')`, which makes FastAPI run this cleanup before the response is sent,
    so a client can never see a response for a write that has not been committed yet.
    """
    with database.transaction() as connection:
        yield connection


# What every repository takes as its connection.
DbConnection = Depends(get_db, scope='function')
