"""add inventory tables and before/after task fields

Revision ID: 007_inventory_before_after
Revises: 006_add_due_date_to_tasks
Create Date: 2026-03-04 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "007_inventory_before_after"
down_revision = "006_add_due_date_to_tasks"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    cols = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "inventory_areas"):
        op.create_table(
            "inventory_areas",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_inventory_areas_id", "inventory_areas", ["id"])
        op.create_index("ix_inventory_areas_user_id", "inventory_areas", ["user_id"])
        op.create_index("ix_inventory_areas_room_id", "inventory_areas", ["room_id"])

    if not _has_table(inspector, "inventory_items"):
        op.create_table(
            "inventory_items",
            sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
            sa.Column("area_id", sa.Integer(), sa.ForeignKey("inventory_areas.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("category", sa.String(length=100), nullable=True),
            sa.Column("photo_url", sa.String(length=500), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_donated", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_inventory_items_id", "inventory_items", ["id"])
        op.create_index("ix_inventory_items_area_id", "inventory_items", ["area_id"])
        op.create_index("ix_inventory_items_user_id", "inventory_items", ["user_id"])
        op.create_index("ix_inventory_items_room_id", "inventory_items", ["room_id"])

    # Add task before/after columns (idempotent).
    task_columns = [
        ("completed_at", sa.DateTime(), True),
        ("before_image_url", sa.String(length=500), True),
        ("after_image_url", sa.String(length=500), True),
        ("before_image_at", sa.DateTime(), True),
        ("after_image_at", sa.DateTime(), True),
        ("assignee_user_id", sa.Integer(), True),
        ("assignee_name", sa.String(length=120), True),
        ("assignee_age", sa.Integer(), True),
        ("is_kid_task", sa.Boolean(), True),
    ]
    inspector = sa.inspect(bind)
    for col_name, col_type, nullable in task_columns:
        if not _has_column(inspector, "tasks", col_name):
            op.add_column("tasks", sa.Column(col_name, col_type, nullable=nullable))

    # Foreign key for tasks.assignee_user_id
    inspector = sa.inspect(bind)
    if _has_column(inspector, "tasks", "assignee_user_id"):
        fk_names = [fk.get("name") for fk in inspector.get_foreign_keys("tasks")]
        if "fk_tasks_assignee_user_id_users" not in fk_names:
            op.create_foreign_key(
                "fk_tasks_assignee_user_id_users",
                source_table="tasks",
                referent_table="users",
                local_cols=["assignee_user_id"],
                remote_cols=["id"],
                ondelete=None,
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    fk_names = [fk.get("name") for fk in inspector.get_foreign_keys("tasks")]
    if "fk_tasks_assignee_user_id_users" in fk_names:
        op.drop_constraint("fk_tasks_assignee_user_id_users", "tasks", type_="foreignkey")

    for col_name in [
        "is_kid_task",
        "assignee_age",
        "assignee_name",
        "assignee_user_id",
        "after_image_at",
        "before_image_at",
        "after_image_url",
        "before_image_url",
        "completed_at",
    ]:
        if _has_column(inspector, "tasks", col_name):
            op.drop_column("tasks", col_name)

    if _has_table(inspector, "inventory_items"):
        op.drop_index("ix_inventory_items_room_id", table_name="inventory_items")
        op.drop_index("ix_inventory_items_user_id", table_name="inventory_items")
        op.drop_index("ix_inventory_items_area_id", table_name="inventory_items")
        op.drop_index("ix_inventory_items_id", table_name="inventory_items")
        op.drop_table("inventory_items")

    if _has_table(inspector, "inventory_areas"):
        op.drop_index("ix_inventory_areas_room_id", table_name="inventory_areas")
        op.drop_index("ix_inventory_areas_user_id", table_name="inventory_areas")
        op.drop_index("ix_inventory_areas_id", table_name="inventory_areas")
        op.drop_table("inventory_areas")
