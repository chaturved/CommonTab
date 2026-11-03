"""Members: group people no longer have to be accounts.

`members` replaces `group_members`. Expenses, settlements and the allocations inside expenses now point at
member ids instead of account ids. Existing rows are converted: one member per old group member, named after
the account, with every reference remapped.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        'members',
        sa.Column('id', sa.Uuid, primary_key=True),
        sa.Column('group_id', sa.Uuid, sa.ForeignKey('expense_groups.id'), nullable=False),
        sa.Column('user_id', sa.Uuid, sa.ForeignKey('users.id')),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('created_at', TS, nullable=False),
    )
    op.create_index('members_group', 'members', ['group_id'])
    op.create_index('members_user', 'members', ['user_id'])
    # An account is at most one member of a group; people without an account are not limited.
    op.create_index('members_group_user', 'members', ['group_id', 'user_id'], unique=True,
                    postgresql_where=sa.text('user_id IS NOT NULL'))

    op.execute('''
        INSERT INTO members (id, group_id, user_id, name, created_at)
        SELECT gen_random_uuid(), gm.group_id, gm.user_id, u.name, u.created_at
        FROM group_members gm JOIN users u ON u.id = gm.user_id
    ''')

    # Re-point references from accounts to members (the foreign keys must go first).
    op.drop_constraint('expenses_payer_id_fkey', 'expenses', type_='foreignkey')
    op.drop_constraint('settlements_from_id_fkey', 'settlements', type_='foreignkey')
    op.drop_constraint('settlements_to_id_fkey', 'settlements', type_='foreignkey')
    op.execute('''UPDATE expenses e SET payer_id = m.id FROM members m
                  WHERE m.group_id = e.group_id AND m.user_id = e.payer_id''')
    op.execute('''UPDATE settlements s SET from_id = m.id FROM members m
                  WHERE m.group_id = s.group_id AND m.user_id = s.from_id''')
    op.execute('''UPDATE settlements s SET to_id = m.id FROM members m
                  WHERE m.group_id = s.group_id AND m.user_id = s.to_id''')
    op.execute('''
        UPDATE expenses e SET allocations = (
            SELECT jsonb_agg(jsonb_set(t.a, '{memberID}', to_jsonb(m.id::text)) ORDER BY t.ord)
            FROM jsonb_array_elements(e.allocations) WITH ORDINALITY AS t(a, ord)
            JOIN members m ON m.group_id = e.group_id AND m.user_id = (t.a ->> 'memberID')::uuid
        )
    ''')
    op.create_foreign_key('expenses_payer_id_fkey', 'expenses', 'members', ['payer_id'], ['id'])
    op.create_foreign_key('settlements_from_id_fkey', 'settlements', 'members', ['from_id'], ['id'])
    op.create_foreign_key('settlements_to_id_fkey', 'settlements', 'members', ['to_id'], ['id'])

    op.drop_table('group_members')


def downgrade() -> None:
    conn = op.get_bind()
    if conn.execute(sa.text('SELECT 1 FROM members WHERE user_id IS NULL LIMIT 1')).fetchone():
        raise RuntimeError('Cannot downgrade: some members have no account, and the old schema cannot hold them.')

    op.create_table(
        'group_members',
        sa.Column('group_id', sa.Uuid, sa.ForeignKey('expense_groups.id'), primary_key=True),
        sa.Column('user_id', sa.Uuid, sa.ForeignKey('users.id'), primary_key=True),
    )
    op.create_index('group_members_user', 'group_members', ['user_id'])
    op.execute('INSERT INTO group_members (group_id, user_id) SELECT group_id, user_id FROM members')

    op.drop_constraint('expenses_payer_id_fkey', 'expenses', type_='foreignkey')
    op.drop_constraint('settlements_from_id_fkey', 'settlements', type_='foreignkey')
    op.drop_constraint('settlements_to_id_fkey', 'settlements', type_='foreignkey')
    op.execute('''
        UPDATE expenses e SET allocations = (
            SELECT jsonb_agg(jsonb_set(t.a, '{memberID}', to_jsonb(m.user_id::text)) ORDER BY t.ord)
            FROM jsonb_array_elements(e.allocations) WITH ORDINALITY AS t(a, ord)
            JOIN members m ON m.group_id = e.group_id AND m.id = (t.a ->> 'memberID')::uuid
        )
    ''')
    op.execute('UPDATE expenses e SET payer_id = m.user_id FROM members m WHERE m.id = e.payer_id')
    op.execute('UPDATE settlements s SET from_id = m.user_id FROM members m WHERE m.id = s.from_id')
    op.execute('UPDATE settlements s SET to_id = m.user_id FROM members m WHERE m.id = s.to_id')
    op.create_foreign_key('expenses_payer_id_fkey', 'expenses', 'users', ['payer_id'], ['id'])
    op.create_foreign_key('settlements_from_id_fkey', 'settlements', 'users', ['from_id'], ['id'])
    op.create_foreign_key('settlements_to_id_fkey', 'settlements', 'users', ['to_id'], ['id'])

    op.drop_table('members')
