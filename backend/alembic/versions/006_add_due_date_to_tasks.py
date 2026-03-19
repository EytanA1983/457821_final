"""add due_date to tasks

Revision ID: 006_add_due_date_to_tasks
Revises: add_room_to_shopping
Create Date: 2026-02-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '006_add_due_date_to_tasks'
down_revision = 'add_room_to_shopping'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column already exists (for safety)
    # If it exists, this migration will be a no-op
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('tasks')]
    
    if 'due_date' not in columns:
        # Add due_date column to tasks table
        # Using DateTime to support both date and time (for Google Calendar sync)
        op.add_column('tasks', sa.Column('due_date', sa.DateTime(), nullable=True))
        
        # Create index for better query performance on due_date
        op.create_index('ix_tasks_due_date', 'tasks', ['due_date'])


def downgrade() -> None:
    # Drop index first
    op.drop_index('ix_tasks_due_date', table_name='tasks')
    
    # Drop column
    op.drop_column('tasks', 'due_date')
