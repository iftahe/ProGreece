"""Add plan versioning (planned_amount_v2) to budget_categories."""
import os
import sys

def main():
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url.startswith("postgresql"):
        import psycopg2
        conn = psycopg2.connect(db_url)
        c = conn.cursor()
        try:
            c.execute("ALTER TABLE budget_categories ADD COLUMN planned_amount_v2 NUMERIC(18,2)")
            print("[migration] Added planned_amount_v2 column (PostgreSQL)")
        except Exception as e:
            print(f"[migration] planned_amount_v2: {e}")
        conn.commit()
        conn.close()
    else:
        import sqlite3
        db_path = "greece_project.db"
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        try:
            c.execute("ALTER TABLE budget_categories ADD COLUMN planned_amount_v2 NUMERIC(18,2)")
            print("[migration] Added planned_amount_v2 column (SQLite)")
        except Exception as e:
            print(f"[migration] planned_amount_v2: {e}")
        conn.commit()
        conn.close()

if __name__ == "__main__":
    main()
