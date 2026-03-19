"""Add token_blocklist table

Revision ID: 005
Revises: 004_add_refresh_tokens
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004_add_refresh_tokens'  # Fixed: must match revision ID from 004
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create token_blocklist table
    op.create_table(
        'token_blocklist',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('jti', sa.String(length=36), nullable=False),
        sa.Column('token_type', sa.String(length=20), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti')
    )

    # Create indexes
    op.create_index('ix_token_blocklist_jti', 'token_blocklist', ['jti'])
    op.create_index('ix_token_blocklist_user_type', 'token_blocklist', ['user_id', 'token_type'])
    op.create_index('ix_token_blocklist_expires', 'token_blocklist', ['expires_at'])
    op.create_index(op.f('ix_token_blocklist_id'), 'token_blocklist', ['id'], unique=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index(op.f('ix_token_blocklist_id'), table_name='token_blocklist')
    op.drop_index('ix_token_blocklist_expires', table_name='token_blocklist')
    op.drop_index('ix_token_blocklist_user_type', table_name='token_blocklist')
    op.drop_index('ix_token_blocklist_jti', table_name='token_blocklist')

    # Drop table
    op.drop_table('token_blocklist')
