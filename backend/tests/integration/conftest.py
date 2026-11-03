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
from app.core.migrate import upgrade


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
    engine = create_db_engine(database_url, schema=test_schema, pre_ping=False)
    with engine.begin() as connection:
        upgrade(connection)
    yield engine
    engine.dispose()


@pytest.fixture
def database(engine) -> Database:
    """The migrated test schema, emptied before each test."""
    with engine.begin() as connection:
        names = [row[0] for row in connection.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'alembic_version'"))]
        connection.execute(text('TRUNCATE ' + ', '.join(f'"{n}"' for n in names) + ' CASCADE'))
    return Database(engine)


@pytest.fixture(autouse=True)
def clean_overrides():
    from app.main import app
    yield
    app.dependency_overrides.clear()
