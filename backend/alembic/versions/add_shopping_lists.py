"""Add shopping lists and items

Revision ID: add_shopping_lists
Revises:
Create Date: 2026-02-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = 'add_shopping_lists'
down_revision = '005'  # Previous migration: 005_add_token_blocklist_table (revision='005')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create shopping_lists table
    op.create_table(
        'shopping_lists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_template', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('reminder_time', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shopping_lists_id'), 'shopping_lists', ['id'], unique=False)
    op.create_index(op.f('ix_shopping_lists_user_id'), 'shopping_lists', ['user_id'], unique=False)

    # Create shopping_items table
    op.create_table(
        'shopping_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('shopping_list_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('quantity', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_checked', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_fixed', sa.Boolean(), nullable=True, default=False),
        sa.Column('order', sa.Integer(), nullable=True, default=0),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
        sa.Column('checked_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['shopping_list_id'], ['shopping_lists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_shopping_items_id'), 'shopping_items', ['id'], unique=False)
    op.create_index(op.f('ix_shopping_items_shopping_list_id'), 'shopping_items', ['shopping_list_id'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order (items first, then lists)
    op.drop_index(op.f('ix_shopping_items_shopping_list_id'), table_name='shopping_items')
    op.drop_index(op.f('ix_shopping_items_id'), table_name='shopping_items')
    op.drop_table('shopping_items')

    op.drop_index(op.f('ix_shopping_lists_user_id'), table_name='shopping_lists')
    op.drop_index(op.f('ix_shopping_lists_id'), table_name='shopping_lists')
    op.drop_table('shopping_lists')
