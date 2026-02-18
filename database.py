from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import sqlite3
import os
import logging

logger = logging.getLogger(__name__)

# Check if running on Render
IS_RENDER = os.environ.get("RENDER")

if IS_RENDER:
    # Fixed path matching the Render persistent disk mount
    RENDER_DATA_DIR = "/opt/render/project/src/data"
    DB_NAME = os.path.join(RENDER_DATA_DIR, "greece_project.db")

    # Ensure the data directory exists BEFORE engine creation
    if not os.path.exists(RENDER_DATA_DIR):
        try:
            os.makedirs(RENDER_DATA_DIR, exist_ok=True)
            logger.info(f"Created data directory: {RENDER_DATA_DIR}")
        except Exception as e:
            logger.error(f"Failed to create data directory {RENDER_DATA_DIR}: {e}")
    else:
        logger.info(f"Data directory exists: {RENDER_DATA_DIR}")

    logger.info(f"Render mode: DB_NAME={DB_NAME}")
else:
    # Local development path
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_NAME = os.path.join(BASE_DIR, "greece_project.db")
    logger.info(f"Local mode: DB_NAME={DB_NAME}")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_NAME}"
logger.info(f"SQLAlchemy URL: {SQLALCHEMY_DATABASE_URL}")

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