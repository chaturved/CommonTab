"""Initial schema: accounts, groups, expenses, settlements, bill sessions, analytics.

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid, primary_key=True),
        sa.Column('email', sa.Text, nullable=False, unique=True),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('password_hash', sa.Text, nullable=False),
        sa.Column('created_at', TS, nullable=False),
    )
    op.create_table(
        'auth_tokens',
        sa.Column('token_hash', sa.Text, primary_key=True),
        sa.Column('user_id', sa.Uuid, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', TS, nullable=False),
    )
    op.create_index('auth_tokens_user', 'auth_tokens', ['user_id'])
    op.create_table(
        'expense_groups',
        sa.Column('id', sa.Uuid, primary_key=True),
        sa.Column('name', sa.Text, nullable=False),
        sa.Column('currency_code', sa.Text, nullable=False),
        sa.Column('owner_id', sa.Uuid, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', TS, nullable=False),
        sa.Column('version', sa.Integer, nullable=False, server_default='1'),
    )
    op.create_table(
        'group_members',
        sa.Column('group_id', sa.Uuid, sa.ForeignKey('expense_groups.id'), primary_key=True),
        sa.Column('user_id', sa.Uuid, sa.ForeignKey('users.id'), primary_key=True),
    )
    op.create_index('group_members_user', 'group_members', ['user_id'])
    op.create_table(
        'invitations',
        sa.Column('token_hash', sa.Text, primary_key=True),
        sa.Column('group_id', sa.Uuid, sa.ForeignKey('expense_groups.id'), nullable=False),
        sa.Column('email', sa.Text, nullable=False),
        sa.Column('expires_at', TS, nullable=False),
        sa.Column('accepted_at', TS),
    )
    op.create_table(
        'expenses',
        sa.Column('id', sa.Uuid, primary_key=True),
        sa.Column('group_id', sa.Uuid, sa.ForeignKey('expense_groups.id'), nullable=False),
        sa.Column('merchant', sa.Text, nullable=False),
        sa.Column('occurred_at', TS, nullable=False),
        sa.Column('category', sa.Text, nullable=False),
        sa.Column('notes', sa.Text, nullable=False),
        sa.Column('amount_minor', sa.BigInteger, nullable=False),
        sa.Column('payer_id', sa.Uuid, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('method', sa.Text, nullable=False),
        sa.Column('allocations', postgresql.JSONB, nullable=False),
        sa.Column('input_values', postgresql.JSONB, nullable=False),
        sa.Column('version', sa.Integer, nullable=False),
        sa.Column('receipt', sa.LargeBinary),
        sa.Column('receipt_type', sa.Text),
        sa.Column('updated_at', TS, nullable=False),
    )
    op.create_index('expenses_group', 'expenses', ['group_id'])
    op.create_table(
        'settlements',
        sa.Column('id', sa.Uuid, primary_key=True),
        sa.Column('group_id', sa.Uuid, sa.ForeignKey('expense_groups.id'), nullable=False),
        sa.Column('from_id', sa.Uuid, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('to_id', sa.Uuid, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount_minor', sa.BigInteger, nullable=False),
        sa.Column('created_at', TS, nullable=False),
    )
    op.create_index('settlements_group', 'settlements', ['group_id'])
    op.create_table(
        'bill_sessions',
        sa.Column('id', sa.Uuid, primary_key=True),
        sa.Column('token_hash', sa.Text, nullable=False),
        sa.Column('version', sa.Integer, nullable=False),
        sa.Column('bill', postgresql.JSONB, nullable=False),
        sa.Column('expires_at', TS, nullable=False),
    )
    op.create_table(
        'event_counts',
        sa.Column('name', sa.Text, primary_key=True),
        sa.Column('variant', sa.Text, primary_key=True),
        sa.Column('count', sa.BigInteger, nullable=False),
    )


def downgrade() -> None:
    for table in ('event_counts', 'bill_sessions', 'settlements', 'expenses', 'invitations',
                  'group_members', 'expense_groups', 'auth_tokens', 'users'):
        op.drop_table(table)
