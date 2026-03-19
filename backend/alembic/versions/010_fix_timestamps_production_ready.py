"""fix timestamps production ready

Revision ID: 010_fix_timestamps_production_ready
Revises: 009_add_daily_focus
Create Date: 2026-03-05 00:00:00.000000

This migration fixes timestamps to use server_default and onupdate for production-ready behavior.
It also adds created_at/updated_at to models that were missing them.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


revision = "010_fix_timestamps_production_ready"
down_revision = "009_add_daily_focus"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # =====================================================
    # Fix Task timestamps
    # =====================================================
    if "tasks" in inspector.get_table_names():
        # Check if columns exist
        task_columns = [col["name"] for col in inspector.get_columns("tasks")]
        
        # Update created_at to use server_default
        if "created_at" in task_columns:
            op.alter_column(
                "tasks",
                "created_at",
                type_=sa.DateTime(timezone=True),
                server_default=func.now(),
                nullable=False,
            )
        else:
            # Add created_at if missing
            op.add_column(
                "tasks",
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
            )
            op.create_index("ix_tasks_created_at", "tasks", ["created_at"])
        
        # Update updated_at to use server_default and onupdate
        if "updated_at" in task_columns:
            op.alter_column(
                "tasks",
                "updated_at",
                type_=sa.DateTime(timezone=True),
                server_default=func.now(),
                nullable=False,
            )
            # Fill NULL values with created_at or current time
            op.execute(
                sa.text("""
                    UPDATE tasks 
                    SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)
                    WHERE updated_at IS NULL
                """)
            )
        else:
            # Add updated_at if missing
            op.add_column(
                "tasks",
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
            )
            # Fill with created_at or current time for existing rows
            op.execute(
                sa.text("""
                    UPDATE tasks 
                    SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)
                """)
            )
            # Note: onupdate is handled by SQLAlchemy, not at DB level for all databases
    
    # =====================================================
    # Add User timestamps
    # =====================================================
    if "users" in inspector.get_table_names():
        user_columns = [col["name"] for col in inspector.get_columns("users")]
        
        if "created_at" not in user_columns:
            op.add_column(
                "users",
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
            )
            op.create_index("ix_users_created_at", "users", ["created_at"])
        
        if "updated_at" not in user_columns:
            op.add_column(
                "users",
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
            )
    
    # =====================================================
    # Add Room timestamps
    # =====================================================
    if "rooms" in inspector.get_table_names():
        room_columns = [col["name"] for col in inspector.get_columns("rooms")]
        
        if "created_at" not in room_columns:
            op.add_column(
                "rooms",
                sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
            )
            op.create_index("ix_rooms_created_at", "rooms", ["created_at"])
        
        if "updated_at" not in room_columns:
            op.add_column(
                "rooms",
                sa.Column("updated_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
            )
    
    # =====================================================
    # Fix ShoppingList timestamps
    # =====================================================
    if "shopping_lists" in inspector.get_table_names():
        shopping_columns = [col["name"] for col in inspector.get_columns("shopping_lists")]
        
        if "created_at" in shopping_columns:
            op.alter_column(
                "shopping_lists",
                "created_at",
                type_=sa.DateTime(timezone=True),
                server_default=func.now(),
                nullable=False,
            )
        
        if "updated_at" in shopping_columns:
            op.alter_column(
                "shopping_lists",
                "updated_at",
                type_=sa.DateTime(timezone=True),
                server_default=func.now(),
                nullable=False,
            )
    
    # =====================================================
    # Fix ShoppingItem timestamps
    # =====================================================
    if "shopping_items" in inspector.get_table_names():
        item_columns = [col["name"] for col in inspector.get_columns("shopping_items")]
        
        if "created_at" in item_columns:
            op.alter_column(
                "shopping_items",
                "created_at",
                type_=sa.DateTime(timezone=True),
                server_default=func.now(),
                nullable=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Remove Room timestamps
    if "rooms" in inspector.get_table_names():
        room_columns = [col["name"] for col in inspector.get_columns("rooms")]
        if "updated_at" in room_columns:
            op.drop_column("rooms", "updated_at")
        if "created_at" in room_columns:
            op.drop_index("ix_rooms_created_at", table_name="rooms")
            op.drop_column("rooms", "created_at")
    
    # Remove User timestamps
    if "users" in inspector.get_table_names():
        user_columns = [col["name"] for col in inspector.get_columns("users")]
        if "updated_at" in user_columns:
            op.drop_column("users", "updated_at")
        if "created_at" in user_columns:
            op.drop_index("ix_users_created_at", table_name="users")
            op.drop_column("users", "created_at")
    
    # Note: Reverting Task and ShoppingList timestamps to old format is complex
    # and may not be necessary. Leaving as-is for safety.
