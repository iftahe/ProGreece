"""Add plan versioning (planned_amount_v2) to budget_categories."""
import os
import sys

# Resolve database path the same way database.py does
IS_RENDER = os.environ.get("RENDER")

if IS_RENDER:
    _DB_PATH = os.path.join("/opt/render/project/src/data", "greece_project.db")
else:
    _DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "greece_project.db")


def main():
    import sqlite3
    conn = sqlite3.connect(_DB_PATH)
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE budget_categories ADD COLUMN planned_amount_v2 NUMERIC(18,2)")
        print(f"[migration] Added planned_amount_v2 column (SQLite) at {_DB_PATH}")
    except Exception as e:
        print(f"[migration] planned_amount_v2: {e}")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
