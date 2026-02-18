from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import sqlite3
import os
import sys

print("=" * 50, flush=True)
print("[database.py] Module loading...", flush=True)

# Check if running on Render
IS_RENDER = os.environ.get("RENDER")
PORT = os.environ.get("PORT", "not set")
print(f"[database.py] IS_RENDER={IS_RENDER}, PORT={PORT}", flush=True)

if IS_RENDER:
    # Fixed path matching the Render persistent disk mount
    RENDER_DATA_DIR = "/opt/render/project/src/data"
    DB_NAME = os.path.join(RENDER_DATA_DIR, "greece_project.db")

    # Ensure the data directory exists BEFORE engine creation
    if not os.path.exists(RENDER_DATA_DIR):
        try:
            os.makedirs(RENDER_DATA_DIR, exist_ok=True)
            print(f"[database.py] Created data directory: {RENDER_DATA_DIR}", flush=True)
        except Exception as e:
            print(f"[database.py] ERROR creating directory: {e}", flush=True)
    else:
        print(f"[database.py] Data directory exists: {RENDER_DATA_DIR}", flush=True)
        # List contents for debugging
        try:
            contents = os.listdir(RENDER_DATA_DIR)
            print(f"[database.py] Directory contents: {contents}", flush=True)
        except Exception as e:
            print(f"[database.py] Cannot list directory: {e}", flush=True)

    # Seed: if persistent disk DB is missing/empty, copy from repo
    import shutil
    REPO_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "greece_project.db")
    needs_seed = not os.path.exists(DB_NAME) or os.path.getsize(DB_NAME) == 0

    if needs_seed and os.path.exists(REPO_DB) and os.path.getsize(REPO_DB) > 0:
        try:
            shutil.copy2(REPO_DB, DB_NAME)
            print(f"[database.py] SEEDED persistent disk DB from repo ({os.path.getsize(REPO_DB)} bytes)", flush=True)
        except Exception as e:
            print(f"[database.py] ERROR seeding DB: {e}", flush=True)
    elif needs_seed:
        print(f"[database.py] WARNING: Persistent disk DB empty and no repo seed found at {REPO_DB}", flush=True)
    else:
        print(f"[database.py] Persistent disk DB exists ({os.path.getsize(DB_NAME)} bytes)", flush=True)

    print(f"[database.py] Render mode: DB_NAME={DB_NAME}", flush=True)
else:
    # Local development path
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_NAME = os.path.join(BASE_DIR, "greece_project.db")
    print(f"[database.py] Local mode: DB_NAME={DB_NAME}", flush=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_NAME}"
print(f"[database.py] SQLAlchemy URL: {SQLALCHEMY_DATABASE_URL}", flush=True)

# --- SQLAlchemy setup ---
try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    print("[database.py] Engine created successfully", flush=True)
except Exception as e:
    print(f"[database.py] FATAL: Engine creation failed: {e}", flush=True)
    sys.exit(1)

Base = declarative_base()

# --- Raw SQLite connection ---
def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

print("[database.py] Module loaded OK", flush=True)