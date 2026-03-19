-- Database initialization script
-- This runs automatically when the database container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'Asia/Jerusalem';

-- Daily Focus table (align with Alembic 009 + ORM)
CREATE TABLE IF NOT EXISTS daily_focus (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    task_id INTEGER,
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    CONSTRAINT uq_daily_focus_user_date UNIQUE (user_id, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS ix_daily_focus_id ON daily_focus(id);
CREATE INDEX IF NOT EXISTS ix_daily_focus_user_id ON daily_focus(user_id);
CREATE INDEX IF NOT EXISTS ix_daily_focus_date ON daily_focus(date);

-- Emotional journal (align with Alembic 008 + ORM EmotionalJournalEntry)
CREATE TABLE IF NOT EXISTS emotional_journal_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_name VARCHAR(200) NOT NULL,
    why_keep TEXT,
    spark_joy BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_emotional_journal_entries_user_id ON emotional_journal_entries(user_id);
CREATE INDEX IF NOT EXISTS ix_emotional_journal_entries_created_at ON emotional_journal_entries(created_at);