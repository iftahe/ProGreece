from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import sqlite3
import os

# Check if running on Render
IS_RENDER = os.environ.get("RENDER")

if IS_RENDER:
    # Fixed path matching the Render persistent disk mount
    RENDER_DATA_DIR = "/opt/render/project/src/data"
    DB_NAME = os.path.join(RENDER_DATA_DIR, "greece_project.db")

    # Ensure the data directory exists BEFORE engine creation
    if not os.path.exists(RENDER_DATA_DIR):
        os.makedirs(RENDER_DATA_DIR, exist_ok=True)

    # Seed: if persistent disk DB has no data, copy from repo
    import shutil
    REPO_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "greece_project.db")

    needs_seed = False
    if not os.path.exists(DB_NAME):
        needs_seed = True
    else:
        try:
            _conn = sqlite3.connect(DB_NAME)
            _count = _conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
            _conn.close()
            if _count == 0:
                needs_seed = True
        except Exception:
            needs_seed = True

    if needs_seed and os.path.exists(REPO_DB) and os.path.getsize(REPO_DB) > 0:
        shutil.copy2(REPO_DB, DB_NAME)
else:
    # Local development path
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_NAME = os.path.join(BASE_DIR, "greece_project.db")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_NAME}"

# --- SQLAlchemy setup ---
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- Raw SQLite connection ---
def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn
