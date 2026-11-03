from uuid import uuid4

import pytest
from sqlalchemy import inspect, text

from app.core.db import create_db_engine
from app.core.migrate import downgrade, upgrade

TABLES = {'users', 'auth_tokens', 'expense_groups', 'group_members', 'invitations', 'expenses',
          'settlements', 'bill_sessions', 'event_counts', 'alembic_version'}


@pytest.fixture
def scratch(database_url):
    """A schema of its own, so migrating up and down cannot disturb the shared test schema."""
    name = f'test_{uuid4().hex[:12]}'
    admin = create_db_engine(database_url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{name}"'))
    engine = create_db_engine(database_url, schema=name)
    yield engine, name
    engine.dispose()
    assert name.startswith('test_')
    with admin.begin() as connection:
        connection.execute(text(f'DROP SCHEMA IF EXISTS "{name}" CASCADE'))
    admin.dispose()


def tables(engine, schema):
    return set(inspect(engine).get_table_names(schema=schema))


def test_upgrade_creates_every_table_and_downgrade_removes_them(scratch):
    engine, schema = scratch
    with engine.begin() as connection:
        upgrade(connection)
    assert tables(engine, schema) == TABLES
    with engine.begin() as connection:
        downgrade(connection, 'base')
    assert tables(engine, schema) <= {'alembic_version'}
    with engine.begin() as connection:
        upgrade(connection)
    assert tables(engine, schema) == TABLES


def test_money_and_ids_use_exact_types(scratch):
    engine, schema = scratch
    with engine.begin() as connection:
        upgrade(connection)
    columns = {c['name']: str(c['type']) for c in inspect(engine).get_columns('expenses', schema=schema)}
    assert columns['amount_minor'] == 'BIGINT'
    assert columns['id'] == 'UUID'
    assert columns['allocations'] == 'JSONB'
    assert columns['occurred_at'].startswith('TIMESTAMP')


def test_tombstone_column_is_added_by_0002_and_removed_on_downgrade(scratch):
    engine, schema = scratch
    names = lambda: {c['name'] for c in inspect(engine).get_columns('expenses', schema=schema)}  # noqa: E731
    with engine.begin() as connection:
        upgrade(connection, '0001')
    assert 'deleted_at' not in names()
    with engine.begin() as connection:
        upgrade(connection)
    assert 'deleted_at' in names()
    with engine.begin() as connection:
        downgrade(connection, '0001')
    assert 'deleted_at' not in names()
