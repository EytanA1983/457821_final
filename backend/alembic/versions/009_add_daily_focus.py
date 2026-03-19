"""add daily_focus table

Revision ID: 009_add_daily_focus
Revises: 008_add_emotional_journal
Create Date: 2026-03-04 23:15:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "009_add_daily_focus"
down_revision = "008_add_emotional_journal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "daily_focus" in inspector.get_table_names():
        return

    op.create_table(
        "daily_focus",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "date", name="uq_daily_focus_user_date"),
    )
    op.create_index("ix_daily_focus_id", "daily_focus", ["id"])
    op.create_index("ix_daily_focus_user_id", "daily_focus", ["user_id"])
    op.create_index("ix_daily_focus_date", "daily_focus", ["date"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "daily_focus" not in inspector.get_table_names():
        return
    op.drop_index("ix_daily_focus_date", table_name="daily_focus")
    op.drop_index("ix_daily_focus_user_id", table_name="daily_focus")
    op.drop_index("ix_daily_focus_id", table_name="daily_focus")
    op.drop_table("daily_focus")
