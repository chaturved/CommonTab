"""Activity log: who did what in a group, in order.

Revision ID: 0008
Revises: 0007
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        'activity',
        sa.Column('seq', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('group_id', sa.Uuid, sa.ForeignKey('expense_groups.id'), nullable=False),
        sa.Column('actor_id', sa.Uuid, sa.ForeignKey('members.id')),
        sa.Column('kind', sa.Text, nullable=False),
        sa.Column('subject_id', sa.Uuid),
        sa.Column('data', JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', TS, nullable=False),
    )
    op.create_index('activity_group_seq', 'activity', ['group_id', 'seq'])


def downgrade() -> None:
    op.drop_table('activity')
