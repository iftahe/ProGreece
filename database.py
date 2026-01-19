from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import sqlite3

# שם קובץ הדאטה-בייס
DB_NAME = "greece_project.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///./{DB_NAME}"

# --- חלק 1: הגדרות עבור main.py (SQLAlchemy) ---
# זה מה שהשרת צריך כדי לרוץ
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- חלק 2: הגדרות עבור סקריפטים ודוחות (Raw SQLite) ---
# זה מה שסקריפט הייבוא ודוח התקציב צריכים
def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn