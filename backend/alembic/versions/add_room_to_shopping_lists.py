"""add room_id to shopping_lists

Revision ID: add_room_to_shopping
Revises: add_shopping_lists
Create Date: 2026-02-02 20:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_room_to_shopping'
down_revision = 'add_shopping_lists'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add room_id column to shopping_lists
    op.add_column('shopping_lists',
        sa.Column('room_id', sa.Integer(), nullable=True))

    # Create foreign key constraint
    op.create_foreign_key(
        'fk_shopping_lists_room_id',
        'shopping_lists', 'rooms',
        ['room_id'], ['id'],
        ondelete='SET NULL'
    )

    # Create index for better query performance
    op.create_index('ix_shopping_lists_room_id',
        'shopping_lists', ['room_id'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_shopping_lists_room_id', table_name='shopping_lists')

    # Drop foreign key
    op.drop_constraint('fk_shopping_lists_room_id',
        'shopping_lists', type_='foreignkey')

    # Drop column
    op.drop_column('shopping_lists', 'room_id')
