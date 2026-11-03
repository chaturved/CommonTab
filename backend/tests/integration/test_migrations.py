from uuid import uuid4

import pytest
from sqlalchemy import inspect, text

from app.core.db import create_db_engine
from app.core.migrate import downgrade, upgrade

TABLES = {'users', 'auth_tokens', 'expense_groups', 'members', 'invitations', 'expenses',
          'settlements', 'bill_sessions', 'event_counts', 'password_resets', 'alembic_version'}


@pytest.fixture
def scratch(database_url):
    name = f'test_{uuid4().hex[:12]}'
    admin = create_db_engine(database_url, pool_size=1, max_overflow=0)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{name}"'))
    engine = create_db_engine(database_url, schema=name, pool_size=1, max_overflow=0)
    yield engine, name
    engine.dispose()
    assert name.startswith('test_')
    with admin.begin() as connection:
        connection.execute(text(f'DROP SCHEMA IF EXISTS "{name}" CASCADE'))
    admin.dispose()


def tables(engine, schema):
    return set(inspect(engine).get_table_names(schema=schema))


class TestMigrations:
    def test_upgrade_creates_every_table_and_downgrade_removes_them(self, scratch):
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

    def test_money_and_ids_use_exact_types(self, scratch):
        engine, schema = scratch
        with engine.begin() as connection:
            upgrade(connection)
        columns = {c['name']: str(c['type']) for c in inspect(engine).get_columns('expenses', schema=schema)}
        assert columns['amount_minor'] == 'BIGINT'
        assert columns['id'] == 'UUID'
        assert columns['allocations'] == 'JSONB'
        assert columns['occurred_at'].startswith('TIMESTAMP')

    def test_tombstone_column_is_added_by_0002_and_removed_on_downgrade(self, scratch):
        engine, schema = scratch
        names = lambda: {c['name'] for c in inspect(engine).get_columns('expenses', schema=schema)}  # noqa: E731
        with engine.begin() as connection:
            upgrade(connection, '0001')
        assert 'deleted_at' not in names()
        with engine.begin() as connection:
            upgrade(connection, '0002')
        assert 'deleted_at' in names()
        with engine.begin() as connection:
            downgrade(connection, '0001')
        assert 'deleted_at' not in names()

    def test_0003_converts_existing_data_to_members_and_back(self, scratch):
        engine, schema = scratch
        ada, bob, group, expense, settlement = (uuid4() for _ in range(5))
        with engine.begin() as connection:
            upgrade(connection, '0002')
            run = lambda sql, **p: connection.execute(text(sql), p)  # noqa: E731
            for uid, name, email in ((ada, 'Ada', 'ada@x.com'), (bob, 'Bob', 'bob@x.com')):
                run("INSERT INTO users VALUES (:i, :e, :n, 'h', now())", i=uid, e=email, n=name)
            run("INSERT INTO expense_groups VALUES (:g, 'Trip', 'USD', :o, now(), 1)", g=group, o=ada)
            for uid in (ada, bob):
                run('INSERT INTO group_members VALUES (:g, :u)', g=group, u=uid)
            run('''INSERT INTO expenses (id, group_id, merchant, occurred_at, category, notes, amount_minor, payer_id,
                                         method, allocations, input_values, version, updated_at)
                   VALUES (:e, :g, 'Dinner', now(), 'dining', '', 1001, :a, 'equal',
                           cast(:alloc as jsonb), '[]'::jsonb, 1, now())''',
                e=expense, g=group, a=ada,
                alloc=f'[{{"memberID": "{ada}", "minorUnits": 501}}, {{"memberID": "{bob}", "minorUnits": 500}}]')
            run("INSERT INTO settlements VALUES (:s, :g, :f, :t, 500, now())", s=settlement, g=group, f=bob, t=ada)

        with engine.begin() as connection:
            upgrade(connection)
            rows = connection.execute(text('SELECT id, user_id, name FROM members ORDER BY name')).fetchall()
            assert [(r.user_id, r.name) for r in rows] == [(ada, 'Ada'), (bob, 'Bob')]
            member = {r.user_id: r.id for r in rows}
            payer, allocations = connection.execute(text('SELECT payer_id, allocations FROM expenses')).one()
            assert payer == member[ada]
            assert allocations == [{'memberID': str(member[ada]), 'minorUnits': 501},
                                   {'memberID': str(member[bob]), 'minorUnits': 500}]
            paid = connection.execute(text('SELECT from_id, to_id FROM settlements')).one()
            assert (paid.from_id, paid.to_id) == (member[bob], member[ada])

        with engine.begin() as connection:
            downgrade(connection, '0002')
            assert connection.execute(text('SELECT payer_id FROM expenses')).scalar() == ada
            assert connection.execute(text('SELECT allocations FROM expenses')).scalar()[1]['memberID'] == str(bob)
            assert connection.execute(text('SELECT count(*) FROM group_members')).scalar() == 2

    def test_0003_downgrade_refuses_when_people_without_accounts_exist(self, scratch):
        engine, schema = scratch
        group, owner = uuid4(), uuid4()
        with engine.begin() as connection:
            upgrade(connection)
            connection.execute(text("INSERT INTO users VALUES (:i, 'a@x.com', 'A', 'h', now())"), {'i': owner})
            connection.execute(text("INSERT INTO expense_groups VALUES (:g, 'T', 'USD', :o, now(), 1)"), {'g': group, 'o': owner})
            connection.execute(text("INSERT INTO members VALUES (:i, :g, NULL, 'Sam', now())"), {'i': uuid4(), 'g': group})
        with pytest.raises(Exception, match='no account'):
            with engine.begin() as connection:
                downgrade(connection, '0002')

    def test_invitations_can_name_a_member_from_0004(self, scratch):
        engine, schema = scratch
        names = lambda: {c['name'] for c in inspect(engine).get_columns('invitations', schema=schema)}  # noqa: E731
        with engine.begin() as connection:
            upgrade(connection, '0003')
        assert 'member_id' not in names()
        with engine.begin() as connection:
            upgrade(connection)
        assert 'member_id' in names()
        with engine.begin() as connection:
            downgrade(connection, '0003')
        assert 'member_id' not in names()

    def test_invitations_may_have_no_email_from_0005_and_downgrade_drops_those_codes(self, scratch):
        engine, schema = scratch
        nullable = lambda: next(c['nullable'] for c in inspect(engine).get_columns('invitations', schema=schema)  # noqa: E731
                                if c['name'] == 'email')
        with engine.begin() as connection:
            upgrade(connection, '0004')
        assert nullable() is False
        with engine.begin() as connection:
            upgrade(connection)
            run = lambda sql, **p: connection.execute(text(sql), p)  # noqa: E731
            user, group = uuid4(), uuid4()
            run("INSERT INTO users VALUES (:i, 'a@x.com', 'Ada', 'h', now())", i=user)
            run("INSERT INTO expense_groups VALUES (:g, 'Trip', 'USD', :u, now(), 1)", g=group, u=user)
            run("INSERT INTO invitations (token_hash, group_id, email, expires_at) VALUES ('code', :g, NULL, now())", g=group)
            run("INSERT INTO invitations (token_hash, group_id, email, expires_at) VALUES ('mail', :g, 'b@x.com', now())", g=group)
        assert nullable() is True
        with engine.begin() as connection:
            downgrade(connection, '0004')
            remaining = connection.execute(text('SELECT token_hash FROM invitations')).scalars().all()
        assert remaining == ['mail'] and nullable() is False

    def test_password_resets_exist_from_0006_and_go_on_downgrade(self, scratch):
        engine, schema = scratch
        with engine.begin() as connection:
            upgrade(connection, '0005')
        assert 'password_resets' not in tables(engine, schema)
        with engine.begin() as connection:
            upgrade(connection)
        assert 'password_resets' in tables(engine, schema)
        with engine.begin() as connection:
            downgrade(connection, '0005')
        assert 'password_resets' not in tables(engine, schema)

    def test_group_lifecycle_columns_exist_from_0007_and_go_on_downgrade(self, scratch):
        engine, schema = scratch
        columns = lambda table: {c['name'] for c in inspect(engine).get_columns(table, schema=schema)}  # noqa: E731
        with engine.begin() as connection:
            upgrade(connection, '0006')
        assert 'archived_at' not in columns('expense_groups') and 'removed_at' not in columns('members')
        with engine.begin() as connection:
            upgrade(connection)
        assert {'archived_at', 'deleted_at'} <= columns('expense_groups') and 'removed_at' in columns('members')
        with engine.begin() as connection:
            downgrade(connection, '0006')
        assert 'deleted_at' not in columns('expense_groups') and 'removed_at' not in columns('members')
