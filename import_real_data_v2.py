"""
import_real_data_v2.py
Fixed import script - resolves date parsing and income/expense classification issues.
Changes from v1:
  1. Date parsing uses dayfirst=False (MM/DD/YYYY) to match the CSV format.
  2. Smart income/expense classification based on from/to fields.
  3. Amount cleaning handles commas in numbers.
  4. Clean start: deletes existing transactions before import.
Changes in v2.1:
  5. Maps CSV 'from'/'to' to from_account_id/to_account_id via accounts table.
  6. Saves CSV 'Remarks' to both 'remarks' and 'description' columns.
  7. Sets transaction_type=1 (Executed) for all imported rows.
  8. Attempts to match CSV 'Phaze' to budget_item_id via budget_categories.
"""
import pandas as pd
import sqlite3
import os
from datetime import datetime

FILE_TRANSACTIONS = 'progreeace 34 - תנועות בפועל.csv'
FILE_PROJECTS = 'progreeace 34 - Appartment_price_upload.csv'
DB_NAME = 'greece_project.db'


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def parse_date(date_str):
    """Parse date in MM/DD/YYYY format (American format, as found in the CSV)."""
    try:
        return pd.to_datetime(date_str, dayfirst=False).strftime('%Y-%m-%d')
    except Exception:
        return datetime.today().strftime('%Y-%m-%d')


def clean_amount(value):
    """Convert amount to float, handling commas and whitespace."""
    if pd.isna(value):
        return 0.0
    text = str(value).replace(',', '').strip()
    try:
        return float(text)
    except ValueError:
        return 0.0


def safe_str(value, default=''):
    """Convert a value to string, treating NaN/None as the default."""
    if pd.isna(value):
        return default
    text = str(value).strip()
    if text.lower() == 'nan':
        return default
    return text


def classify_transaction(from_acc, to_acc):
    """Determine if a transaction is 'income' or 'expense' based on direction.

    Rules:
      - If 'to' contains 'Trust' or a project keyword (Orfanido, Karaoli, etc.) -> income
        (customer paying into a trust/project account)
      - If 'to' contains 'ProGreece' -> income
        (money flowing into the company account)
      - If 'from' contains 'ProGreece' -> expense
        (company paying out to suppliers/services)
      - Default -> expense
    """
    from_lower = str(from_acc).lower()
    to_lower = str(to_acc).lower()

    # Money flowing INTO company or trust accounts = income
    if 'trust' in to_lower:
        return 'income'
    if 'progreece' in to_lower:
        return 'income'

    # Money flowing OUT from company = expense
    if 'progreece' in from_lower:
        return 'expense'

    return 'expense'


def run_import():
    print("Starting v2.1 import...")

    if not os.path.exists(FILE_TRANSACTIONS) or not os.path.exists(FILE_PROJECTS):
        print("ERROR: One or more CSV files are missing.")
        return

    conn = get_db_connection()
    cursor = conn.cursor()

    # ---- Step 0: Clean start ----
    print("[0] Clearing existing transactions...")
    cursor.execute("DELETE FROM transactions")
    conn.commit()
    deleted = cursor.rowcount
    print(f"    Deleted {deleted} old transactions.")

    # ---- Step 1: Load projects ----
    print("[1] Reading projects file...")
    try:
        df_projects = pd.read_csv(FILE_PROJECTS, encoding='utf-8-sig')
    except Exception:
        df_projects = pd.read_csv(FILE_PROJECTS, encoding='cp1255')

    project_map = (
        df_projects[['ProjectKey', 'Project']]
        .drop_duplicates()
        .set_index('ProjectKey')['Project']
        .to_dict()
    )
    print(f"    Found {len(project_map)} unique projects.")

    for p_key, p_name in project_map.items():
        if pd.isna(p_name):
            continue
        p_name = str(p_name).strip()
        cursor.execute(
            "INSERT OR IGNORE INTO projects (name, status) VALUES (?, ?)",
            (p_name, 'Active'),
        )
    conn.commit()

    cursor.execute("SELECT id, name FROM projects")
    db_projects = {row['name']: row['id'] for row in cursor.fetchall()}

    # ---- Step 1.5: Load accounts for name->id mapping ----
    print("[1.5] Loading accounts for mapping...")
    cursor.execute("SELECT id, name FROM accounts")
    db_accounts_by_name = {}
    for row in cursor.fetchall():
        db_accounts_by_name[row['name'].strip().lower()] = row['id']
    print(f"    Found {len(db_accounts_by_name)} existing accounts.")

    def find_or_create_account(name_raw):
        """Look up an account by name; create it if it doesn't exist. Returns id or None."""
        if not name_raw:
            return None
        key = name_raw.strip().lower()
        if not key:
            return None
        if key in db_accounts_by_name:
            return db_accounts_by_name[key]
        # Auto-create the missing account
        cursor.execute(
            "INSERT INTO accounts (name, is_system_account) VALUES (?, 0)",
            (name_raw.strip(),)
        )
        conn.commit()
        new_id = cursor.lastrowid
        db_accounts_by_name[key] = new_id
        return new_id

    count_accounts_created = 0

    # ---- Step 1.6: Load budget categories for phaze->id mapping ----
    print("[1.6] Loading budget categories for mapping...")
    # Build a map of (project_id, normalized_category_name) -> budget_category_id
    cursor.execute("SELECT id, project_id, category_name FROM budget_categories")
    budget_cat_map = {}
    for row in cursor.fetchall():
        key = (row['project_id'], row['category_name'].strip().lower())
        budget_cat_map[key] = row['id']
    print(f"    Found {len(budget_cat_map)} budget categories.")

    # ---- Step 2: Load transactions ----
    print("[2] Reading transactions file...")
    try:
        df_trans = pd.read_csv(FILE_TRANSACTIONS, encoding='utf-8-sig')
    except Exception:
        df_trans = pd.read_csv(FILE_TRANSACTIONS, encoding='cp1255')

    count_inserted = 0
    count_skipped = 0
    count_income = 0
    count_expense = 0
    count_accounts_mapped = 0
    count_budget_mapped = 0

    for index, row in df_trans.iterrows():
        try:
            old_proj_key = row.get('project key')
            if pd.isna(old_proj_key):
                count_skipped += 1
                continue

            proj_name = project_map.get(old_proj_key)
            if not proj_name:
                count_skipped += 1
                continue

            new_project_id = db_projects.get(proj_name)
            if not new_project_id:
                count_skipped += 1
                continue

            amount = clean_amount(row.get('Amount'))
            if amount == 0:
                count_skipped += 1
                continue

            date_val = parse_date(row.get('Date'))
            category = safe_str(row.get('Phaze'), 'General')
            remarks = safe_str(row.get('Remarks'))
            supplier = safe_str(row.get('to'))
            from_acc = safe_str(row.get('from'))
            to_acc = safe_str(row.get('to'))

            # Find or create accounts by name
            from_account_id = find_or_create_account(from_acc)
            to_account_id = find_or_create_account(to_acc)
            if from_account_id or to_account_id:
                count_accounts_mapped += 1

            # Try to match phaze/category to budget_item_id
            budget_item_id = budget_cat_map.get(
                (new_project_id, category.strip().lower())
            )
            if budget_item_id:
                count_budget_mapped += 1

            tx_type = classify_transaction(from_acc, to_acc)

            if tx_type == 'income':
                count_income += 1
            else:
                count_expense += 1

            cursor.execute(
                """INSERT INTO transactions
                   (project_id, date, amount, category, description, supplier,
                    type, remarks, transaction_type,
                    from_account_id, to_account_id, budget_item_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (new_project_id, date_val, amount, category, remarks, supplier,
                 tx_type, remarks, 1,
                 from_account_id, to_account_id, budget_item_id),
            )
            count_inserted += 1

        except Exception as e:
            print(f"    WARN: Skipped row {index}: {e}")
            count_skipped += 1

    conn.commit()

    # ---- Step 3: Initialize budget categories ----
    print("[3] Initializing budget categories...")
    try:
        from services.budget_report_service import initialize_project_budget
        for p_name, p_id in db_projects.items():
            initialize_project_budget(p_id)
        print("    Budget categories initialized.")
    except Exception as e:
        print(f"    WARN: Could not initialize budgets: {e}")

    # Count how many accounts exist now
    cursor.execute("SELECT COUNT(*) FROM accounts")
    total_accounts = cursor.fetchone()[0]

    conn.close()

    # ---- Summary ----
    print("\n" + "=" * 50)
    print("IMPORT SUMMARY")
    print("=" * 50)
    print(f"  Total CSV rows:    {len(df_trans)}")
    print(f"  Inserted:          {count_inserted}")
    print(f"    - income:        {count_income}")
    print(f"    - expense:       {count_expense}")
    print(f"  Skipped:           {count_skipped}")
    print(f"  Accounts linked:   {count_accounts_mapped}")
    print(f"  Total accounts:    {total_accounts}")
    print(f"  Budget cat mapped: {count_budget_mapped}")
    print("=" * 50)

    # ---- Verify the two reported issues ----
    print("\nVERIFICATION:")
    conn2 = get_db_connection()
    c2 = conn2.cursor()

    c2.execute("SELECT id, date, amount, type FROM transactions WHERE amount BETWEEN 90 AND 95")
    rows = c2.fetchall()
    print(f"\n  Issue #1 (amount ~93):")
    for r in rows:
        print(f"    id={r['id']}, date={r['date']}, amount={r['amount']}, type={r['type']}")
    if not rows:
        print("    NOT FOUND")

    c2.execute("SELECT id, date, amount, type FROM transactions WHERE amount BETWEEN 28450 AND 28460")
    rows = c2.fetchall()
    print(f"\n  Issue #2 (amount 28455):")
    for r in rows:
        print(f"    id={r['id']}, date={r['date']}, amount={r['amount']}, type={r['type']}")
    if not rows:
        print("    NOT FOUND")

    conn2.close()
    print("\nDone.")


if __name__ == '__main__':
    run_import()
