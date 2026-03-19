"""
SQLite schema repair for local/dev — single source of truth.

- Idempotent: safe to run multiple times; only adds missing columns / missing tables.
- Does NOT drop tables or destroy data.
- Aligns core tables with SQLAlchemy models under app/db/models (auth, dashboard,
  rooms, tasks, daily reset, journal, progress-related tasks, shopping, inventory).

Usage:
  python scripts/patch_sqlite_schema.py [--db PATH] [--report-only]

Environment:
  Defaults to backend/eli_maor_dev.db (parent of scripts/).
"""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path
from typing import Callable, Iterable


DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "eli_maor_dev.db"

# ---------------------------------------------------------------------------
# Expected columns per ORM model (for --report-only mismatch detection)
# Source: app/db/models/*.py — keep in sync when models change.
# ---------------------------------------------------------------------------
EXPECTED_MODEL_COLUMNS: dict[str, set[str]] = {
    "users": {
        "id",
        "email",
        "hashed_password",
        "is_active",
        "is_superuser",
        "full_name",
        "google_refresh_token",
        "created_at",
        "updated_at",
    },
    "rooms": {
        "id",
        "name",
        "owner_id",
        "is_shared",
        "created_at",
        "updated_at",
    },
    "tasks": {
        "id",
        "title",
        "description",
        "completed",
        "position",
        "category_id",
        "assignee_user_id",
        "assignee_name",
        "assignee_age",
        "is_kid_task",
        "room_id",
        "user_id",
        "due_date",
        "recurrence",
        "rrule_string",
        "rrule_start_date",
        "rrule_end_date",
        "parent_task_id",
        "is_recurring_template",
        "created_at",
        "completed_at",
        "before_image_url",
        "after_image_url",
        "before_image_at",
        "after_image_at",
        "updated_at",
    },
    "daily_focus": {
        "id",
        "user_id",
        "task_id",
        "date",
        "completed_at",
    },
    "room_shares": {
        "id",
        "room_id",
        "user_id",
        "permission",
        "shared_by",
        "created_at",
    },
    "categories": {"id", "name", "icon", "user_id", "position"},
    "todos": {"id", "title", "completed", "task_id", "position"},
    "emotional_journal_entries": {
        "id",
        "user_id",
        "item_name",
        "why_keep",
        "spark_joy",
        "created_at",
    },
    "shopping_lists": {
        "id",
        "user_id",
        "room_id",
        "name",
        "description",
        "is_template",
        "is_active",
        "reminder_time",
        "created_at",
        "updated_at",
        "completed_at",
    },
    "shopping_items": {
        "id",
        "shopping_list_id",
        "name",
        "quantity",
        "category",
        "notes",
        "is_checked",
        "is_fixed",
        "order",
        "created_at",
        "checked_at",
    },
    "oauth_accounts": {
        "id",
        "oauth_name",
        "access_token",
        "expires_at",
        "refresh_token",
        "account_id",
        "account_email",
        "user_id",
        "created_at",
        "updated_at",
    },
    "refresh_tokens": {
        "id",
        "user_id",
        "jti",
        "expires_at",
        "created_at",
        "revoked",
        "revoked_at",
        "device_info",
        "ip_address",
    },
    "token_blocklist": {
        "id",
        "jti",
        "token_type",
        "user_id",
        "expires_at",
        "revoked_at",
        "reason",
    },
    "inventory_areas": {
        "id",
        "user_id",
        "room_id",
        "name",
        "description",
        "created_at",
        "updated_at",
    },
    "inventory_items": {
        "id",
        "area_id",
        "user_id",
        "room_id",
        "name",
        "quantity",
        "category",
        "photo_url",
        "notes",
        "is_donated",
        "created_at",
        "updated_at",
    },
}


def get_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def has_table(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def add_missing_columns(
    conn: sqlite3.Connection, table_name: str, required_sql: dict[str, str]
) -> list[str]:
    existing = get_columns(conn, table_name)
    added: list[str] = []
    for column_name, alter_sql in required_sql.items():
        if column_name not in existing:
            conn.execute(alter_sql)
            added.append(column_name)
    return added


def backfill_null_timestamps(
    conn: sqlite3.Connection, table_name: str, columns: Iterable[str]
) -> None:
    existing = get_columns(conn, table_name)
    for column in columns:
        if column in existing:
            conn.execute(
                f"UPDATE {table_name} "
                f"SET {column} = COALESCE({column}, CURRENT_TIMESTAMP) "
                f"WHERE {column} IS NULL"
            )


def backfill_integer_default(
    conn: sqlite3.Connection,
    table_name: str,
    column: str,
    default: int = 0,
    *,
    quote_column: bool = False,
) -> None:
    if column not in get_columns(conn, table_name):
        return
    qc = f'"{column}"' if quote_column else column
    conn.execute(
        f"UPDATE {table_name} SET {qc} = COALESCE({qc}, ?) WHERE {qc} IS NULL",
        (default,),
    )


def log_table(table: str, message: str) -> None:
    print(f"[patch] {table}: {message}")


# --- Per-table column patches (ALTER ADD only) --------------------------------


def patch_users(conn: sqlite3.Connection) -> list[str]:
    required = {
        "created_at": "ALTER TABLE users ADD COLUMN created_at DATETIME",
        "updated_at": "ALTER TABLE users ADD COLUMN updated_at DATETIME",
        "full_name": "ALTER TABLE users ADD COLUMN full_name TEXT",
        "google_refresh_token": "ALTER TABLE users ADD COLUMN google_refresh_token TEXT",
        "is_superuser": "ALTER TABLE users ADD COLUMN is_superuser INTEGER DEFAULT 0",
    }
    added = add_missing_columns(conn, "users", required)
    backfill_null_timestamps(conn, "users", ("created_at", "updated_at"))
    if "is_superuser" in get_columns(conn, "users"):
        backfill_integer_default(conn, "users", "is_superuser", 0)
    return added


def patch_rooms(conn: sqlite3.Connection) -> list[str]:
    cols = get_columns(conn, "rooms")
    added: list[str] = []

    # Legacy schema: user_id instead of owner_id (ORM expects owner_id)
    if "owner_id" not in cols and "user_id" in cols:
        conn.execute("ALTER TABLE rooms ADD COLUMN owner_id INTEGER")
        conn.execute("UPDATE rooms SET owner_id = user_id WHERE owner_id IS NULL")
        added.append("owner_id (backfilled from user_id)")
        cols = get_columns(conn, "rooms")

    required = {
        "created_at": "ALTER TABLE rooms ADD COLUMN created_at DATETIME",
        "updated_at": "ALTER TABLE rooms ADD COLUMN updated_at DATETIME",
        "is_shared": "ALTER TABLE rooms ADD COLUMN is_shared INTEGER DEFAULT 0",
        "owner_id": "ALTER TABLE rooms ADD COLUMN owner_id INTEGER",
    }
    for name, sql in required.items():
        if name not in cols:
            # owner_id handled above if user_id existed; skip duplicate add
            if name == "owner_id" and "owner_id" in get_columns(conn, "rooms"):
                continue
            conn.execute(sql)
            added.append(name)
            cols = get_columns(conn, "rooms")

    backfill_null_timestamps(conn, "rooms", ("created_at", "updated_at"))
    if "is_shared" in get_columns(conn, "rooms"):
        backfill_integer_default(conn, "rooms", "is_shared", 0)
    if "owner_id" in get_columns(conn, "rooms"):
        # Cannot invent owner; leave NULL only if no rows — app may fail until fixed
        pass
    return added


def patch_tasks(conn: sqlite3.Connection) -> list[str]:
    required = {
        "created_at": "ALTER TABLE tasks ADD COLUMN created_at DATETIME",
        "updated_at": "ALTER TABLE tasks ADD COLUMN updated_at DATETIME",
        "completed_at": "ALTER TABLE tasks ADD COLUMN completed_at DATETIME",
        "position": "ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0",
        "assignee_user_id": "ALTER TABLE tasks ADD COLUMN assignee_user_id INTEGER",
        "assignee_name": "ALTER TABLE tasks ADD COLUMN assignee_name TEXT",
        "assignee_age": "ALTER TABLE tasks ADD COLUMN assignee_age INTEGER",
        "is_kid_task": "ALTER TABLE tasks ADD COLUMN is_kid_task INTEGER DEFAULT 0",
        "recurrence": "ALTER TABLE tasks ADD COLUMN recurrence TEXT DEFAULT 'none'",
        "rrule_string": "ALTER TABLE tasks ADD COLUMN rrule_string TEXT",
        "rrule_start_date": "ALTER TABLE tasks ADD COLUMN rrule_start_date DATETIME",
        "rrule_end_date": "ALTER TABLE tasks ADD COLUMN rrule_end_date DATETIME",
        "parent_task_id": "ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER",
        "is_recurring_template": "ALTER TABLE tasks ADD COLUMN is_recurring_template INTEGER DEFAULT 0",
        "before_image_url": "ALTER TABLE tasks ADD COLUMN before_image_url TEXT",
        "after_image_url": "ALTER TABLE tasks ADD COLUMN after_image_url TEXT",
        "before_image_at": "ALTER TABLE tasks ADD COLUMN before_image_at DATETIME",
        "after_image_at": "ALTER TABLE tasks ADD COLUMN after_image_at DATETIME",
        "due_date": "ALTER TABLE tasks ADD COLUMN due_date DATETIME",
        "category_id": "ALTER TABLE tasks ADD COLUMN category_id INTEGER",
        "room_id": "ALTER TABLE tasks ADD COLUMN room_id INTEGER",
        "description": "ALTER TABLE tasks ADD COLUMN description TEXT",
    }
    added = add_missing_columns(conn, "tasks", required)
    backfill_null_timestamps(conn, "tasks", ("created_at", "updated_at"))
    for col, default in (
        ("position", 0),
        ("is_kid_task", 0),
        ("is_recurring_template", 0),
    ):
        if col in get_columns(conn, "tasks"):
            backfill_integer_default(conn, "tasks", col, default)
    # Enum stored as string; SQLite may have legacy lowercase
    if "recurrence" in get_columns(conn, "tasks"):
        conn.execute(
            "UPDATE tasks SET recurrence = 'none' WHERE recurrence IS NULL OR recurrence = ''"
        )
    return added


def patch_daily_focus_columns(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "daily_focus"):
        return []
    required = {
        "completed_at": "ALTER TABLE daily_focus ADD COLUMN completed_at DATETIME",
        "task_id": "ALTER TABLE daily_focus ADD COLUMN task_id INTEGER",
        "date": "ALTER TABLE daily_focus ADD COLUMN date DATE",
        "user_id": "ALTER TABLE daily_focus ADD COLUMN user_id INTEGER",
    }
    return add_missing_columns(conn, "daily_focus", required)


def patch_room_shares(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "room_shares"):
        return []
    required = {
        "created_at": "ALTER TABLE room_shares ADD COLUMN created_at DATETIME",
        "permission": "ALTER TABLE room_shares ADD COLUMN permission TEXT DEFAULT 'viewer'",
        "shared_by": "ALTER TABLE room_shares ADD COLUMN shared_by INTEGER",
    }
    added = add_missing_columns(conn, "room_shares", required)
    backfill_null_timestamps(conn, "room_shares", ("created_at",))
    if "shared_by" in get_columns(conn, "room_shares"):
        conn.execute(
            "UPDATE room_shares SET shared_by = user_id WHERE shared_by IS NULL"
        )
    return added


def patch_categories(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "categories"):
        return []
    required = {"position": "ALTER TABLE categories ADD COLUMN position INTEGER DEFAULT 0"}
    added = add_missing_columns(conn, "categories", required)
    if "position" in get_columns(conn, "categories"):
        backfill_integer_default(conn, "categories", "position", 0)
    return added


def patch_todos(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "todos"):
        return []
    required = {"position": "ALTER TABLE todos ADD COLUMN position INTEGER DEFAULT 0"}
    added = add_missing_columns(conn, "todos", required)
    if "position" in get_columns(conn, "todos"):
        backfill_integer_default(conn, "todos", "position", 0)
    return added


def patch_oauth_accounts(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "oauth_accounts"):
        return []
    required = {
        "created_at": "ALTER TABLE oauth_accounts ADD COLUMN created_at DATETIME",
        "updated_at": "ALTER TABLE oauth_accounts ADD COLUMN updated_at DATETIME",
    }
    added = add_missing_columns(conn, "oauth_accounts", required)
    backfill_null_timestamps(conn, "oauth_accounts", ("created_at", "updated_at"))
    return added


def patch_refresh_tokens(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "refresh_tokens"):
        return []
    required = {
        "revoked": "ALTER TABLE refresh_tokens ADD COLUMN revoked INTEGER DEFAULT 0",
        "revoked_at": "ALTER TABLE refresh_tokens ADD COLUMN revoked_at DATETIME",
        "device_info": "ALTER TABLE refresh_tokens ADD COLUMN device_info TEXT",
        "ip_address": "ALTER TABLE refresh_tokens ADD COLUMN ip_address TEXT",
    }
    added = add_missing_columns(conn, "refresh_tokens", required)
    if "revoked" in get_columns(conn, "refresh_tokens"):
        backfill_integer_default(conn, "refresh_tokens", "revoked", 0)
    return added


def patch_shopping_lists(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "shopping_lists"):
        return []
    required = {
        "room_id": "ALTER TABLE shopping_lists ADD COLUMN room_id INTEGER",
        "description": "ALTER TABLE shopping_lists ADD COLUMN description TEXT",
        "is_template": "ALTER TABLE shopping_lists ADD COLUMN is_template INTEGER DEFAULT 0",
        "is_active": "ALTER TABLE shopping_lists ADD COLUMN is_active INTEGER DEFAULT 1",
        "reminder_time": "ALTER TABLE shopping_lists ADD COLUMN reminder_time DATETIME",
        "created_at": "ALTER TABLE shopping_lists ADD COLUMN created_at DATETIME",
        "updated_at": "ALTER TABLE shopping_lists ADD COLUMN updated_at DATETIME",
        "completed_at": "ALTER TABLE shopping_lists ADD COLUMN completed_at DATETIME",
    }
    added = add_missing_columns(conn, "shopping_lists", required)
    backfill_null_timestamps(conn, "shopping_lists", ("created_at", "updated_at"))
    for col, d in (("is_template", 0), ("is_active", 1)):
        if col in get_columns(conn, "shopping_lists"):
            backfill_integer_default(conn, "shopping_lists", col, d)
    return added


def patch_shopping_items(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "shopping_items"):
        return []
    required = {
        "quantity": "ALTER TABLE shopping_items ADD COLUMN quantity TEXT",
        "category": "ALTER TABLE shopping_items ADD COLUMN category TEXT",
        "notes": "ALTER TABLE shopping_items ADD COLUMN notes TEXT",
        "is_checked": "ALTER TABLE shopping_items ADD COLUMN is_checked INTEGER DEFAULT 0",
        "is_fixed": "ALTER TABLE shopping_items ADD COLUMN is_fixed INTEGER DEFAULT 0",
        "order": 'ALTER TABLE shopping_items ADD COLUMN "order" INTEGER DEFAULT 0',
        "created_at": "ALTER TABLE shopping_items ADD COLUMN created_at DATETIME",
        "checked_at": "ALTER TABLE shopping_items ADD COLUMN checked_at DATETIME",
    }
    added = add_missing_columns(conn, "shopping_items", required)
    backfill_null_timestamps(conn, "shopping_items", ("created_at",))
    for col, d, quoted in (
        ("is_checked", 0, False),
        ("is_fixed", 0, False),
        ("order", 0, True),
    ):
        if col in get_columns(conn, "shopping_items"):
            backfill_integer_default(conn, "shopping_items", col, d, quote_column=quoted)
    return added


def patch_inventory_areas(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "inventory_areas"):
        return []
    required = {
        "created_at": "ALTER TABLE inventory_areas ADD COLUMN created_at DATETIME",
        "updated_at": "ALTER TABLE inventory_areas ADD COLUMN updated_at DATETIME",
        "room_id": "ALTER TABLE inventory_areas ADD COLUMN room_id INTEGER",
        "description": "ALTER TABLE inventory_areas ADD COLUMN description TEXT",
    }
    added = add_missing_columns(conn, "inventory_areas", required)
    backfill_null_timestamps(conn, "inventory_areas", ("created_at", "updated_at"))
    return added


def patch_inventory_items(conn: sqlite3.Connection) -> list[str]:
    if not has_table(conn, "inventory_items"):
        return []
    required = {
        "room_id": "ALTER TABLE inventory_items ADD COLUMN room_id INTEGER",
        "quantity": "ALTER TABLE inventory_items ADD COLUMN quantity INTEGER DEFAULT 1",
        "category": "ALTER TABLE inventory_items ADD COLUMN category TEXT",
        "photo_url": "ALTER TABLE inventory_items ADD COLUMN photo_url TEXT",
        "notes": "ALTER TABLE inventory_items ADD COLUMN notes TEXT",
        "is_donated": "ALTER TABLE inventory_items ADD COLUMN is_donated INTEGER DEFAULT 0",
        "created_at": "ALTER TABLE inventory_items ADD COLUMN created_at DATETIME",
        "updated_at": "ALTER TABLE inventory_items ADD COLUMN updated_at DATETIME",
    }
    added = add_missing_columns(conn, "inventory_items", required)
    backfill_null_timestamps(conn, "inventory_items", ("created_at", "updated_at"))
    if "quantity" in get_columns(conn, "inventory_items"):
        backfill_integer_default(conn, "inventory_items", "quantity", 1)
    if "is_donated" in get_columns(conn, "inventory_items"):
        backfill_integer_default(conn, "inventory_items", "is_donated", 0)
    return added


# --- CREATE TABLE IF NOT EXISTS (missing tables only) -------------------------


def ensure_table(conn: sqlite3.Connection, name: str, ddl: str) -> bool:
    """Returns True if CREATE was executed (table did not exist)."""
    if has_table(conn, name):
        return False
    conn.executescript(ddl)
    log_table(name, "created table (IF NOT EXISTS)")
    return True


def ensure_daily_focus_table(conn: sqlite3.Connection) -> str:
    if has_table(conn, "daily_focus"):
        return "exists"
    ddl = """
    CREATE TABLE IF NOT EXISTS daily_focus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        task_id INTEGER,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
        UNIQUE (user_id, date)
    );
    CREATE INDEX IF NOT EXISTS ix_daily_focus_user_id ON daily_focus(user_id);
    CREATE INDEX IF NOT EXISTS ix_daily_focus_date ON daily_focus(date);
    """
    ensure_table(conn, "daily_focus", ddl)
    return "created"


def ensure_emotional_journal_table(conn: sqlite3.Connection) -> str:
    if has_table(conn, "emotional_journal_entries"):
        return "exists"
    ddl = """
    CREATE TABLE IF NOT EXISTS emotional_journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        why_keep TEXT,
        spark_joy INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS ix_emotional_journal_user_id ON emotional_journal_entries(user_id);
    """
    ensure_table(conn, "emotional_journal_entries", ddl)
    return "created"


def ensure_shopping_tables(conn: sqlite3.Connection) -> tuple[str, str]:
    st_lists = "exists"
    st_items = "exists"
    if not has_table(conn, "shopping_lists"):
        ddl = """
        CREATE TABLE IF NOT EXISTS shopping_lists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            room_id INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            is_template INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            reminder_time DATETIME,
            created_at DATETIME,
            updated_at DATETIME,
            completed_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
        );
        """
        ensure_table(conn, "shopping_lists", ddl)
        st_lists = "created"
    if not has_table(conn, "shopping_items"):
        ddl = """
        CREATE TABLE IF NOT EXISTS shopping_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shopping_list_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            quantity TEXT,
            category TEXT,
            notes TEXT,
            is_checked INTEGER DEFAULT 0,
            is_fixed INTEGER DEFAULT 0,
            "order" INTEGER DEFAULT 0,
            created_at DATETIME,
            checked_at DATETIME,
            FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
        );
        """
        ensure_table(conn, "shopping_items", ddl)
        st_items = "created"
    return st_lists, st_items


def ensure_inventory_tables(conn: sqlite3.Connection) -> tuple[str, str]:
    ar = "exists"
    it = "exists"
    if not has_table(conn, "inventory_areas"):
        ddl = """
        CREATE TABLE IF NOT EXISTS inventory_areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            room_id INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
        );
        """
        ensure_table(conn, "inventory_areas", ddl)
        ar = "created"
    if not has_table(conn, "inventory_items"):
        ddl = """
        CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            area_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            room_id INTEGER,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            category TEXT,
            photo_url TEXT,
            notes TEXT,
            is_donated INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (area_id) REFERENCES inventory_areas(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
        );
        """
        ensure_table(conn, "inventory_items", ddl)
        it = "created"
    return ar, it


# --- Report -------------------------------------------------------------------


def mismatch_report(conn: sqlite3.Connection) -> dict[str, dict]:
    """table -> { 'missing': [...], 'extra_in_db': [...], 'status': str }."""
    out: dict[str, dict] = {}
    for table, expected in EXPECTED_MODEL_COLUMNS.items():
        if not has_table(conn, table):
            out[table] = {"missing": sorted(expected), "status": "table_missing"}
            continue
        actual = get_columns(conn, table)
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        entry: dict = {"status": "aligned" if not missing else "column_mismatch"}
        if missing:
            entry["missing"] = missing
        if extra:
            entry["extra_in_db"] = extra
        out[table] = entry
    return out


def print_report(conn: sqlite3.Connection) -> None:
    print("[patch] --- Mismatch report (model vs SQLite) ---")
    rep = mismatch_report(conn)
    for table in sorted(rep.keys()):
        info = rep[table]
        status = info.get("status", "?")
        if status == "table_missing":
            log_table(table, f"TABLE MISSING — need columns: {info.get('missing', [])}")
        elif info.get("missing"):
            log_table(table, f"missing columns {info['missing']}")
            if info.get("extra_in_db"):
                log_table(table, f"(note) extra DB columns not in model set: {info['extra_in_db']}")
        else:
            note = f" extra: {info['extra_in_db']}" if info.get("extra_in_db") else ""
            log_table(table, f"aligned{note}")


# --- Main patch pipeline ------------------------------------------------------

PATCH_ORDER: list[tuple[str, Callable[[sqlite3.Connection], list[str]]]] = [
    ("users", patch_users),
    ("rooms", patch_rooms),
    ("tasks", patch_tasks),
    ("room_shares", patch_room_shares),
    ("categories", patch_categories),
    ("todos", patch_todos),
    ("oauth_accounts", patch_oauth_accounts),
    ("refresh_tokens", patch_refresh_tokens),
    ("shopping_lists", patch_shopping_lists),
    ("shopping_items", patch_shopping_items),
    ("inventory_areas", patch_inventory_areas),
    ("inventory_items", patch_inventory_items),
]


def run_patch(conn: sqlite3.Connection) -> dict[str, str]:
    """
    Returns per-table summary label:
      fixed | already_aligned | created_table | skipped (no users table / no table)
    """
    summary: dict[str, str] = {}

    if not has_table(conn, "users"):
        log_table("*", "Table 'users' missing — abort patch (run migrations first).")
        return summary

    # Missing tables that block features
    df_status = ensure_daily_focus_table(conn)
    summary["daily_focus"] = "created_table" if df_status == "created" else "exists"

    ej_status = ensure_emotional_journal_table(conn)
    summary["emotional_journal_entries"] = "created_table" if ej_status == "created" else "exists"

    sl, si = ensure_shopping_tables(conn)
    summary["shopping_lists"] = "created_table" if sl == "created" else "exists"
    summary["shopping_items"] = "created_table" if si == "created" else "exists"

    ia, ii = ensure_inventory_tables(conn)
    summary["inventory_areas"] = "created_table" if ia == "created" else "exists"
    summary["inventory_items"] = "created_table" if ii == "created" else "exists"

    # daily_focus column patch (if table existed without completed_at)
    if has_table(conn, "daily_focus"):
        added = patch_daily_focus_columns(conn)
        if added:
            log_table("daily_focus", f"added columns {added}")
            summary["daily_focus"] = "fixed"
        elif summary.get("daily_focus") != "created_table":
            summary["daily_focus"] = "already_aligned"

    for table, patch_fn in PATCH_ORDER:
        if table == "users":
            pass  # always run
        elif not has_table(conn, table):
            summary[table] = "skipped_no_table"
            continue
        added = patch_fn(conn)
        if added:
            log_table(table, f"added columns {added}")
            summary[table] = "fixed"
        else:
            summary[table] = summary.get(table, "already_aligned")

    # Re-evaluate users/rooms/tasks if only ensures ran
    for t in ("users", "rooms", "tasks", "room_shares", "categories", "todos"):
        if t not in summary:
            summary[t] = "already_aligned"

    return summary


def print_final_summary_with_conn(conn: sqlite3.Connection, summary: dict[str, str]) -> None:
    print("[patch] --- Summary ---")
    priority = [
        "users",
        "rooms",
        "tasks",
        "daily_focus",
        "room_shares",
        "categories",
        "todos",
        "emotional_journal_entries",
        "shopping_lists",
        "shopping_items",
        "oauth_accounts",
        "refresh_tokens",
        "inventory_areas",
        "inventory_items",
    ]
    for name in priority:
        if name in summary:
            print(f"[patch]   {name}: {summary[name]}")
    rep = mismatch_report(conn)
    problems = [
        t
        for t, d in rep.items()
        if d.get("missing") or d.get("status") == "table_missing"
    ]
    if problems:
        print(f"[patch] remaining issues (run --report-only for detail): {problems}")
    else:
        print("[patch] remaining model vs DB column mismatches: none")


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair SQLite schema vs SQLAlchemy models.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Path to SQLite file")
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Print mismatch report only; do not modify the database.",
    )
    args = parser.parse_args()
    db_path: Path = args.db

    if not db_path.exists():
        print(f"[patch] Database file not found: {db_path}")
        return 1

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON")

        if args.report_only:
            print_report(conn)
            return 0

        summary = run_patch(conn)
        conn.commit()

    print("[patch] SQLite schema patch complete.")
    with sqlite3.connect(db_path) as conn2:
        print_final_summary_with_conn(conn2, summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
