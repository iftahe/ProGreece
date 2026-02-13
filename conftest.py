"""
Shared test fixtures for ProGreece backend tests.
Provides in-memory SQLite database, test client, and helper factories.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app, get_db
import models

# In-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_db():
    """Drop and recreate all tables before each test for isolation."""
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    """Provide a raw DB session for direct inserts in tests."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sample_project(client):
    """Create and return a sample project via API."""
    res = client.post("/projects/", json={
        "name": "Test Project",
        "status": "Active",
        "account_balance": 1000.0,
    })
    assert res.status_code == 200
    return res.json()


@pytest.fixture
def sample_accounts(db):
    """Insert accounts directly into DB (no POST /accounts/ endpoint)."""
    regular = models.Account(name="Regular Account", is_system_account=0)
    system = models.Account(name="System Account", is_system_account=1)
    db.add_all([regular, system])
    db.commit()
    db.refresh(regular)
    db.refresh(system)
    return {"regular": regular, "system": system}


@pytest.fixture
def sample_budget_category(db, sample_project):
    """Insert a budget category directly into DB."""
    cat = models.BudgetCategory(
        project_id=sample_project["id"],
        category_name="Construction",
        planned_amount=100000.0,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@pytest.fixture
def sample_apartment(client, sample_project):
    """Create and return a sample apartment via API."""
    pid = sample_project["id"]
    res = client.post(f"/projects/{pid}/apartments", json={
        "name": "Floor 1 - Apt 101",
        "floor": "1",
        "apartment_number": "101",
        "customer_name": "John Doe",
        "sale_price": 250000.0,
    })
    assert res.status_code == 200
    return res.json()
