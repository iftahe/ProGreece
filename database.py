from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import os

# Update this with your actual connection string
# For local testing with SQLite (as checking models.py implies), or PostgreSQL as requested
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@localhost/dbname"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./greece_project.db")

connect_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
