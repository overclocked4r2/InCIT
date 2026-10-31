"""Initial approved InCIT Schema v1.0.
Revision ID: 0001_schema_v1
Revises:
"""
from alembic import op
from app.db import Base
from app import models  # noqa: F401
revision="0001_schema_v1"
down_revision=None
branch_labels=None
depends_on=None

def upgrade():
    bind=op.get_bind()
    Base.metadata.create_all(bind=bind)
    # Published schedule records and their entries are immutable at the DB boundary.
    if bind.dialect.name == "sqlite":
        op.execute("""CREATE TRIGGER trg_published_schedule_no_update BEFORE UPDATE ON schedules WHEN OLD.status='published' BEGIN SELECT RAISE(ABORT, 'published schedules are immutable'); END""")
        op.execute("""CREATE TRIGGER trg_published_schedule_no_delete BEFORE DELETE ON schedules WHEN OLD.status='published' BEGIN SELECT RAISE(ABORT, 'published schedules are immutable'); END""")
        op.execute("""CREATE TRIGGER trg_published_entry_no_insert BEFORE INSERT ON timetable_entries WHEN (SELECT status FROM schedules WHERE id=NEW.schedule_id)='published' BEGIN SELECT RAISE(ABORT, 'cannot add entries to published schedules'); END""")
        op.execute("""CREATE TRIGGER trg_published_entry_no_update BEFORE UPDATE ON timetable_entries WHEN (SELECT status FROM schedules WHERE id=OLD.schedule_id)='published' OR (SELECT status FROM schedules WHERE id=NEW.schedule_id)='published' BEGIN SELECT RAISE(ABORT, 'published timetable entries are immutable'); END""")
        op.execute("""CREATE TRIGGER trg_published_entry_no_delete BEFORE DELETE ON timetable_entries WHEN (SELECT status FROM schedules WHERE id=OLD.schedule_id)='published' BEGIN SELECT RAISE(ABORT, 'published timetable entries are immutable'); END""")

def downgrade():
    bind=op.get_bind()
    if bind.dialect.name == "sqlite":
        for name in ["trg_published_entry_no_delete","trg_published_entry_no_update","trg_published_entry_no_insert","trg_published_schedule_no_delete","trg_published_schedule_no_update"]:
            op.execute(f"DROP TRIGGER IF EXISTS {name}")
    Base.metadata.drop_all(bind=bind)
