"""
Phase 3 Migration Script
Run once before deploying Phase 3 features.

- Adds apartment_id column to transactions table (Feature 1)
- Adds linked_transaction_ids column to customer_payments table (Feature 5)
- New tables (project_settings, account_category_mappings) are auto-created by create_all()

Usage: python migrate_phase3.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, SessionLocal
from sqlalchemy import text
import models

def run_migration():
    print("Phase 3 Migration - Starting...")

    # Auto-create new tables (ProjectSetting, AccountCategoryMapping)
    models.Base.metadata.create_all(bind=engine)
    print("  [OK] New tables created (project_settings, account_category_mappings)")

    # ALTER TABLE migrations for existing tables
    with engine.connect() as conn:
        # Feature 1: Add apartment_id to transactions
        try:
            conn.execute(text(
                "ALTER TABLE transactions ADD COLUMN apartment_id INTEGER REFERENCES apartments(id)"
            ))
            conn.commit()
            print("  [OK] Added apartment_id to transactions")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("  [SKIP] apartment_id already exists on transactions")
            else:
                print(f"  [WARN] apartment_id migration: {e}")

        # Feature 5: Add linked_transaction_ids to customer_payments
        try:
            conn.execute(text(
                "ALTER TABLE customer_payments ADD COLUMN linked_transaction_ids TEXT"
            ))
            conn.commit()
            print("  [OK] Added linked_transaction_ids to customer_payments")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("  [SKIP] linked_transaction_ids already exists on customer_payments")
            else:
                print(f"  [WARN] linked_transaction_ids migration: {e}")

    print("Phase 3 Migration - Complete!")

if __name__ == "__main__":
    run_migration()
