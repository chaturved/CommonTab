"""Password reset codes (emailed, one hour, a few tries).

Revision ID: 0006
Revises: 0005
"""
import sqlalchemy as sa
from alembic import op

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        'password_resets',
        sa.Column('code_hash', sa.Text, primary_key=True),
        sa.Column('user_id', sa.Uuid, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', TS, nullable=False),
        sa.Column('used_at', TS),
        sa.Column('attempts', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', TS, nullable=False),
    )
    op.create_index('password_resets_user', 'password_resets', ['user_id'])


def downgrade() -> None:
    op.drop_table('password_resets')
