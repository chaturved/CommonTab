"""
Tests run against a real Postgres (DATABASE_URL, e.g. Supabase). Each session creates a throwaway
`test_<random>` schema, migrates it, and drops it at the end; nothing else in the database is touched.
"""
from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.config import load_settings
from app.core.db import Database, create_db_engine


@pytest.fixture(scope='session')
def database_url() -> str:
    try:
        return load_settings().database_url
    except RuntimeError as error:
        pytest.skip(str(error))


@pytest.fixture(scope='session')
def test_schema(database_url):
    name = f'test_{uuid4().hex[:12]}'
    admin = create_db_engine(database_url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{name}"'))
    try:
        yield name
    finally:
        assert name.startswith('test_')  # never drop anything that is not a test schema
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{name}" CASCADE'))
        admin.dispose()


@pytest.fixture(scope='session')
def engine(database_url, test_schema):
    engine = create_db_engine(database_url, schema=test_schema)
    yield engine
    engine.dispose()


@pytest.fixture
def database(engine) -> Database:
    return Database(engine)
