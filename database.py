from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import sqlite3
import os

# בדיקה האם אנחנו רצים ב-Render
IS_RENDER = os.environ.get("RENDER")

if IS_RENDER:
    # נתיב קבוע שתואם בדיוק ל-Mount Path שהגדרת ב-Render
    # חשוב: זה חייב להיות הנתיב המלא מהצילום מסך
    DB_NAME = "/opt/render/project/src/data/greece_project.db"
else:
    # נתיב מקומי למחשב שלך
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_NAME = os.path.join(BASE_DIR, "greece_project.db")

# בגלל ש-DB_NAME מתחיל ב-/, ה-URL יכיל אוטומטית 4 סלאשים (תקין ל-SQLAlchemy)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_NAME}"

# --- חלק 1: הגדרות עבור SQLAlchemy ---
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- חלק 2: הגדרות עבור Raw SQLite ---
def get_db_connection():
    # מוודא שהתיקייה קיימת בנתיב המלא ב-Render
    if IS_RENDER:
        render_data_dir = "/opt/render/project/src/data"
        if not os.path.exists(render_data_dir):
            try:
                os.makedirs(render_data_dir)
            except:
                pass
            
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn