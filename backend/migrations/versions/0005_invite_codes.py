"""Invitations without an email: a short code anyone can join with (invite by code).

`invitations.email` becomes optional. A row with no email is a code for the group (or for one person in it);
rows with an email are the older email-bound invitations and keep working.

Revision ID: 0005
Revises: 0004
"""
import sqlalchemy as sa
from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('invitations', 'email', existing_type=sa.Text, nullable=True)


def downgrade() -> None:
    op.execute('DELETE FROM invitations WHERE email IS NULL')
    op.alter_column('invitations', 'email', existing_type=sa.Text, nullable=False)
