"""
Phase 4 Migration Script - Idempotent
Adds counterparties, customers, invoices, audit_log tables
and extends transactions, apartments, budget_categories, projects tables.
Also seeds data from existing fields and backfills computed columns.

Run from the project root:
    python migrations/phase4_migrate.py
"""

import sqlite3
import os
import sys

# ---------------------------------------------------------------------------
# Resolve database path the same way database.py does
# ---------------------------------------------------------------------------
IS_RENDER = os.environ.get("RENDER")

if IS_RENDER:
    RENDER_DATA_DIR = "/opt/render/project/src/data"
    DB_PATH = os.path.join(RENDER_DATA_DIR, "greece_project.db")
else:
    # Local: DB lives next to database.py (project root)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "greece_project.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign key enforcement
    conn.execute("PRAGMA foreign_keys = OFF")
    return conn


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    ).fetchone()
    return row is not None


def index_exists(conn: sqlite3.Connection, index_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
        (index_name,)
    ).fetchone()
    return row is not None


def add_column(conn: sqlite3.Connection, table: str, column_def: str) -> bool:
    """
    Attempt to add a column. Returns True if added, False if already existed.
    column_def is e.g. "vat_amount NUMERIC(14,2) DEFAULT 0"
    """
    column_name = column_def.split()[0]
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")
        conn.commit()
        print(f"  + {table}.{column_name} added")
        return True
    except sqlite3.OperationalError as exc:
        if "duplicate column name" in str(exc).lower():
            print(f"  . {table}.{column_name} already exists — skipped")
            return False
        raise


# ---------------------------------------------------------------------------
# Step 1 – Create counterparties table
# ---------------------------------------------------------------------------

def create_counterparties(conn: sqlite3.Connection) -> None:
    print("\n[1] Creating 'counterparties' table ...")
    if table_exists(conn, "counterparties"):
        print("  . Already exists — skipped")
        return
    conn.execute("""
        CREATE TABLE IF NOT EXISTS counterparties (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT    NOT NULL,
            vat_number          TEXT,
            default_category_id INTEGER REFERENCES budget_categories(id),
            created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("  + Created")


# ---------------------------------------------------------------------------
# Step 2 – Create customers table
# ---------------------------------------------------------------------------

def create_customers(conn: sqlite3.Connection) -> None:
    print("\n[2] Creating 'customers' table ...")
    if table_exists(conn, "customers"):
        print("  . Already exists — skipped")
        return
    conn.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name  TEXT    NOT NULL,
            email      TEXT,
            phone      TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("  + Created")


# ---------------------------------------------------------------------------
# Step 3 – Create invoices table
# ---------------------------------------------------------------------------

def create_invoices(conn: sqlite3.Connection) -> None:
    print("\n[3] Creating 'invoices' table ...")
    if table_exists(conn, "invoices"):
        print("  . Already exists — skipped")
    else:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS invoices (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id       INTEGER NOT NULL REFERENCES projects(id),
                customer_id      INTEGER REFERENCES customers(id),
                counterparty_id  INTEGER REFERENCES counterparties(id),
                invoice_number   TEXT    NOT NULL,
                invoice_date     DATE    NOT NULL,
                invoice_value    NUMERIC(14,2) NOT NULL,
                currency         TEXT    DEFAULT 'EUR',
                remarks          TEXT,
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        print("  + Created")

    # Unique index — idempotent
    if index_exists(conn, "uq_invoice"):
        print("  . Index uq_invoice already exists — skipped")
    else:
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice
            ON invoices(project_id, invoice_number)
        """)
        conn.commit()
        print("  + Index uq_invoice created")


# ---------------------------------------------------------------------------
# Step 4 – Create audit_log table
# ---------------------------------------------------------------------------

def create_audit_log(conn: sqlite3.Connection) -> None:
    print("\n[4] Creating 'audit_log' table ...")
    if table_exists(conn, "audit_log"):
        print("  . Already exists — skipped")
        return
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type   TEXT    NOT NULL,
            entity_id     INTEGER NOT NULL,
            action        TEXT    NOT NULL,
            diff_json     TEXT,
            actor_user_id INTEGER,
            timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("  + Created")


# ---------------------------------------------------------------------------
# Step 5 – Extend transactions table
# ---------------------------------------------------------------------------

def extend_transactions(conn: sqlite3.Connection) -> None:
    print("\n[5] Extending 'transactions' table ...")
    columns = [
        "vat_amount          NUMERIC(14,2) DEFAULT 0",
        "withholding_amount  NUMERIC(14,2) DEFAULT 0",
        "direction           TEXT",
        "status              TEXT",
        "counterparty_id     INTEGER",
        "customer_id_fk      INTEGER",
        "invoice_id          INTEGER",
        "source_ref          TEXT",
        "currency            TEXT DEFAULT 'EUR'",
        "updated_at          DATETIME",
        "created_by          INTEGER",
        "updated_by          INTEGER",
    ]
    for col_def in columns:
        add_column(conn, "transactions", col_def)


# ---------------------------------------------------------------------------
# Step 6 – Extend apartments table
# ---------------------------------------------------------------------------

def extend_apartments(conn: sqlite3.Connection) -> None:
    print("\n[6] Extending 'apartments' table ...")
    columns = [
        "unit_number  TEXT",
        "customer_id  INTEGER",
        "sale_date    DATE",
    ]
    for col_def in columns:
        add_column(conn, "apartments", col_def)


# ---------------------------------------------------------------------------
# Step 7 – Extend budget_categories table
# ---------------------------------------------------------------------------

def extend_budget_categories(conn: sqlite3.Connection) -> None:
    print("\n[7] Extending 'budget_categories' table ...")
    add_column(conn, "budget_categories", "category_type TEXT DEFAULT 'expense'")


# ---------------------------------------------------------------------------
# Step 8 – Extend projects table
# ---------------------------------------------------------------------------

def extend_projects(conn: sqlite3.Connection) -> None:
    print("\n[8] Extending 'projects' table ...")
    # Note: SQLite does not allow CURRENT_TIMESTAMP as a default in ALTER TABLE ADD COLUMN
    # (only literal constants are allowed).  We add the datetime columns without a default
    # and then backfill them below.
    columns = [
        "is_active   INTEGER DEFAULT 1",
        "cash_buffer NUMERIC(14,2)",
        "code        TEXT",
        "created_at  DATETIME",
        "updated_at  DATETIME",
    ]
    for col_def in columns:
        add_column(conn, "projects", col_def)

    # Backfill created_at / updated_at to now for any rows that have NULL
    conn.execute("""
        UPDATE projects
        SET created_at = CURRENT_TIMESTAMP
        WHERE created_at IS NULL
    """)
    conn.execute("""
        UPDATE projects
        SET updated_at = CURRENT_TIMESTAMP
        WHERE updated_at IS NULL
    """)
    conn.commit()
    print("  + Backfilled projects.created_at / updated_at for existing rows")


# ---------------------------------------------------------------------------
# Step 9 – Seed counterparties from transactions.supplier
# ---------------------------------------------------------------------------

def seed_counterparties(conn: sqlite3.Connection) -> None:
    print("\n[9] Seeding counterparties from transactions.supplier ...")
    # Collect distinct non-empty supplier values
    rows = conn.execute("""
        SELECT DISTINCT supplier
        FROM transactions
        WHERE supplier IS NOT NULL
          AND TRIM(supplier) != ''
    """).fetchall()

    inserted = 0
    for row in rows:
        name = row["supplier"].strip()
        # INSERT OR IGNORE relies on a unique constraint; we use manual check instead
        existing = conn.execute(
            "SELECT id FROM counterparties WHERE name = ?", (name,)
        ).fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO counterparties (name) VALUES (?)", (name,)
            )
            inserted += 1

    conn.commit()
    print(f"  + Inserted {inserted} counterparties ({len(rows)} distinct suppliers found)")


# ---------------------------------------------------------------------------
# Step 10 – Link transactions.counterparty_id to counterparties.name
# ---------------------------------------------------------------------------

def link_transaction_counterparties(conn: sqlite3.Connection) -> None:
    print("\n[10] Linking transactions.counterparty_id from supplier text ...")
    result = conn.execute("""
        UPDATE transactions
        SET counterparty_id = (
            SELECT c.id
            FROM counterparties c
            WHERE TRIM(c.name) = TRIM(transactions.supplier)
            LIMIT 1
        )
        WHERE supplier IS NOT NULL
          AND TRIM(supplier) != ''
          AND counterparty_id IS NULL
    """)
    conn.commit()
    print(f"  + {result.rowcount} transactions linked")


# ---------------------------------------------------------------------------
# Step 11 – Seed customers from apartments.customer_name
# ---------------------------------------------------------------------------

def seed_customers(conn: sqlite3.Connection) -> None:
    print("\n[11] Seeding customers from apartments.customer_name ...")
    rows = conn.execute("""
        SELECT DISTINCT customer_name
        FROM apartments
        WHERE customer_name IS NOT NULL
          AND TRIM(customer_name) != ''
    """).fetchall()

    inserted = 0
    for row in rows:
        full_name = row["customer_name"].strip()
        existing = conn.execute(
            "SELECT id FROM customers WHERE full_name = ?", (full_name,)
        ).fetchone()
        if existing is None:
            conn.execute(
                "INSERT INTO customers (full_name) VALUES (?)", (full_name,)
            )
            inserted += 1

    conn.commit()
    print(f"  + Inserted {inserted} customers ({len(rows)} distinct names found)")


# ---------------------------------------------------------------------------
# Step 12 – Link apartments.customer_id to customers.full_name
# ---------------------------------------------------------------------------

def link_apartment_customers(conn: sqlite3.Connection) -> None:
    print("\n[12] Linking apartments.customer_id from customer_name ...")
    result = conn.execute("""
        UPDATE apartments
        SET customer_id = (
            SELECT c.id
            FROM customers c
            WHERE TRIM(c.full_name) = TRIM(apartments.customer_name)
            LIMIT 1
        )
        WHERE customer_name IS NOT NULL
          AND TRIM(customer_name) != ''
          AND customer_id IS NULL
    """)
    conn.commit()
    print(f"  + {result.rowcount} apartments linked")


# ---------------------------------------------------------------------------
# Step 13 – Backfill apartments.unit_number from apartment_number
# ---------------------------------------------------------------------------

def backfill_unit_number(conn: sqlite3.Connection) -> None:
    print("\n[13] Backfilling apartments.unit_number from apartment_number ...")
    result = conn.execute("""
        UPDATE apartments
        SET unit_number = apartment_number
        WHERE unit_number IS NULL
          AND apartment_number IS NOT NULL
    """)
    conn.commit()
    print(f"  + {result.rowcount} rows updated")


# ---------------------------------------------------------------------------
# Step 14 – Backfill transactions derived columns
# ---------------------------------------------------------------------------

def backfill_transactions(conn: sqlite3.Connection) -> None:
    print("\n[14] Backfilling transactions derived columns ...")

    # vat_amount
    r = conn.execute("""
        UPDATE transactions
        SET vat_amount = amount * vat_rate
        WHERE (vat_amount = 0 OR vat_amount IS NULL)
          AND amount IS NOT NULL
          AND vat_rate IS NOT NULL
          AND vat_rate != 0
    """)
    print(f"  + vat_amount: {r.rowcount} rows updated")

    # withholding_amount
    r = conn.execute("""
        UPDATE transactions
        SET withholding_amount = amount * withholding_rate
        WHERE (withholding_amount = 0 OR withholding_amount IS NULL)
          AND amount IS NOT NULL
          AND withholding_rate IS NOT NULL
          AND withholding_rate != 0
    """)
    print(f"  + withholding_amount: {r.rowcount} rows updated")

    # direction = 'in' for income
    r = conn.execute("""
        UPDATE transactions
        SET direction = 'in'
        WHERE type = 'income'
          AND (direction IS NULL OR direction = '')
    """)
    print(f"  + direction='in': {r.rowcount} rows updated")

    # direction = 'out' for non-income
    r = conn.execute("""
        UPDATE transactions
        SET direction = 'out'
        WHERE (type IS NULL OR type != 'income')
          AND (direction IS NULL OR direction = '')
    """)
    print(f"  + direction='out': {r.rowcount} rows updated")

    # status = 'executed' for transaction_type=1
    r = conn.execute("""
        UPDATE transactions
        SET status = 'executed'
        WHERE transaction_type = 1
          AND (status IS NULL OR status = '')
    """)
    print(f"  + status='executed': {r.rowcount} rows updated")

    # status = 'planned' for other transaction types
    r = conn.execute("""
        UPDATE transactions
        SET status = 'planned'
        WHERE (transaction_type IS NULL OR transaction_type != 1)
          AND (status IS NULL OR status = '')
    """)
    print(f"  + status='planned': {r.rowcount} rows updated")

    conn.commit()


# ---------------------------------------------------------------------------
# Step 15 – Backfill projects.cash_buffer from project_settings
# ---------------------------------------------------------------------------

def backfill_cash_buffer(conn: sqlite3.Connection) -> None:
    print("\n[15] Backfilling projects.cash_buffer from project_settings ...")

    # Check if project_settings table exists
    if not table_exists(conn, "project_settings"):
        print("  . 'project_settings' table not found — skipped")
        return

    result = conn.execute("""
        UPDATE projects
        SET cash_buffer = (
            SELECT ps.cash_buffer_amount
            FROM project_settings ps
            WHERE ps.project_id = projects.id
            LIMIT 1
        )
        WHERE cash_buffer IS NULL
          AND EXISTS (
              SELECT 1 FROM project_settings ps
              WHERE ps.project_id = projects.id
          )
    """)
    conn.commit()
    print(f"  + {result.rowcount} projects updated")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Phase 4 Migration")
    print(f"Database: {DB_PATH}")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    conn = get_connection()

    try:
        # --- Create new tables ---
        create_counterparties(conn)
        create_customers(conn)
        create_invoices(conn)
        create_audit_log(conn)

        # --- Extend existing tables ---
        extend_transactions(conn)
        extend_apartments(conn)
        extend_budget_categories(conn)
        extend_projects(conn)

        # --- Seed data from legacy fields ---
        seed_counterparties(conn)
        link_transaction_counterparties(conn)
        seed_customers(conn)
        link_apartment_customers(conn)

        # --- Backfill derived / migrated columns ---
        backfill_unit_number(conn)
        backfill_transactions(conn)
        backfill_cash_buffer(conn)

        print("\n" + "=" * 60)
        print("Migration completed successfully.")
        print("=" * 60)

    except Exception as exc:
        conn.rollback()
        print(f"\nERROR during migration: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
