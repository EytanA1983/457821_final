"""add emotional journal entries table

Revision ID: 008_add_emotional_journal
Revises: 007_inventory_before_after
Create Date: 2026-03-04 22:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "008_add_emotional_journal"
down_revision = "007_inventory_before_after"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "emotional_journal_entries" in inspector.get_table_names():
        return

    op.create_table(
        "emotional_journal_entries",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_name", sa.String(length=200), nullable=False),
        sa.Column("why_keep", sa.Text(), nullable=True),
        sa.Column("spark_joy", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_emotional_journal_entries_id", "emotional_journal_entries", ["id"])
    op.create_index("ix_emotional_journal_entries_user_id", "emotional_journal_entries", ["user_id"])
    op.create_index("ix_emotional_journal_entries_created_at", "emotional_journal_entries", ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "emotional_journal_entries" not in inspector.get_table_names():
        return

    op.drop_index("ix_emotional_journal_entries_created_at", table_name="emotional_journal_entries")
    op.drop_index("ix_emotional_journal_entries_user_id", table_name="emotional_journal_entries")
    op.drop_index("ix_emotional_journal_entries_id", table_name="emotional_journal_entries")
    op.drop_table("emotional_journal_entries")
