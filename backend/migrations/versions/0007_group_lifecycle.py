"""Archived and deleted groups, and members who left or were removed.

Revision ID: 0007
Revises: 0006
"""
import sqlalchemy as sa
from alembic import op

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column('expense_groups', sa.Column('archived_at', TS))
    op.add_column('expense_groups', sa.Column('deleted_at', TS))
    op.add_column('members', sa.Column('removed_at', TS))


def downgrade() -> None:
    op.drop_column('members', 'removed_at')
    op.drop_column('expense_groups', 'deleted_at')
    op.drop_column('expense_groups', 'archived_at')
