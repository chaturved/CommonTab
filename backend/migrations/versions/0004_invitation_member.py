"""Invitations can target an existing person, so accepting links that person to the account.

Revision ID: 0004
Revises: 0003
"""
import sqlalchemy as sa
from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('invitations', sa.Column('member_id', sa.Uuid, sa.ForeignKey('members.id')))


def downgrade() -> None:
    op.drop_column('invitations', 'member_id')
