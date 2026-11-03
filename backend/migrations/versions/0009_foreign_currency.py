"""Foreign-currency expenses: the original amount, its currency and the rate used.

Revision ID: 0009
Revises: 0008
"""
import sqlalchemy as sa
from alembic import op

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('expenses', sa.Column('currency_code', sa.Text))
    op.add_column('expenses', sa.Column('original_minor', sa.BigInteger))
    op.add_column('expenses', sa.Column('rate_micros', sa.BigInteger))
    op.create_check_constraint(
        'expenses_foreign_currency_complete', 'expenses',
        '(currency_code IS NULL) = (original_minor IS NULL) AND (currency_code IS NULL) = (rate_micros IS NULL)')


def downgrade() -> None:
    op.drop_constraint('expenses_foreign_currency_complete', 'expenses')
    op.drop_column('expenses', 'rate_micros')
    op.drop_column('expenses', 'original_minor')
    op.drop_column('expenses', 'currency_code')
