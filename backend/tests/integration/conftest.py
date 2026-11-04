from __future__ import annotations

import os
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.core.config import normalize_database_url, read_dotenv
from app.core.db import Database, create_db_engine
from app.core.migrate import upgrade


@pytest.fixture(scope='session')
def database_url() -> str:
    url = {**read_dotenv(), **os.environ}.get('TEST_DATABASE_URL', '').strip()
    if not url:
        pytest.skip('TEST_DATABASE_URL is not set. See backend/README.md ("Tests") to set up a local Postgres.')
    return normalize_database_url(url)


@pytest.fixture(scope='session')
def test_schema(database_url):
    name = f'test_{uuid4().hex[:12]}'
    admin = create_db_engine(database_url, pool_size=1, max_overflow=0)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{name}"'))
    try:
        yield name
    finally:
        assert name.startswith('test_')
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{name}" CASCADE'))
        admin.dispose()


@pytest.fixture(scope='session')
def engine(database_url, test_schema):
    engine = create_db_engine(database_url, schema=test_schema, pre_ping=False, pool_size=2, max_overflow=1)
    with engine.begin() as connection:
        upgrade(connection)
    yield engine
    engine.dispose()


@pytest.fixture
def database(engine) -> Database:
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
