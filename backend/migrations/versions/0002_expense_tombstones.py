"""Expense tombstones: deleting sets deleted_at instead of removing the row.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('deleted_at', sa.DateTime(timezone=True)))


def downgrade() -> None:
    # Tombstones cannot exist without the column, so they are dropped for real.
    op.execute('DELETE FROM expenses WHERE deleted_at IS NOT NULL')
    op.drop_column('expenses', 'deleted_at')
