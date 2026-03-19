"""Add daily_focus.completed_at if table exists without it (legacy init.sql / early DBs).

Revision ID: 011_daily_focus_completed_at
Revises: 010_fix_timestamps_production_ready
Create Date: 2026-03-19
"""

from alembic import op
import sqlalchemy as sa


revision = "011_daily_focus_completed_at"
down_revision = "010_fix_timestamps_production_ready"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "daily_focus" not in inspector.get_table_names():
        return
    cols = [c["name"] for c in inspector.get_columns("daily_focus")]
    if "completed_at" in cols:
        return
    op.add_column(
        "daily_focus",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "daily_focus" not in inspector.get_table_names():
        return
    cols = [c["name"] for c in inspector.get_columns("daily_focus")]
    if "completed_at" not in cols:
        return
    op.drop_column("daily_focus", "completed_at")
