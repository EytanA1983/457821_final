"""add vision_journal_entries table

Revision ID: 011_add_vision_journal_entries
Revises: 010_fix_timestamps_production_ready
Create Date: 2026-03-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import func


revision = "011_add_vision_journal_entries"
down_revision = "010_fix_timestamps_production_ready"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "vision_journal_entries" in inspector.get_table_names():
        return

    op.create_table(
        "vision_journal_entries",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entry_type", sa.String(length=16), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("caption", sa.String(length=500), nullable=True),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=func.now(), nullable=False),
    )
    op.create_index("ix_vision_journal_entries_id", "vision_journal_entries", ["id"])
    op.create_index("ix_vision_journal_entries_user_id", "vision_journal_entries", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "vision_journal_entries" not in inspector.get_table_names():
        return
    op.drop_index("ix_vision_journal_entries_user_id", table_name="vision_journal_entries")
    op.drop_index("ix_vision_journal_entries_id", table_name="vision_journal_entries")
    op.drop_table("vision_journal_entries")
