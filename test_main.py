from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest

# Application imports
from main import app, get_db
import models

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables in the test database
models.Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_create_project():
    response = client.post(
        "/projects/",
        json={"name": "Test Project", "status": "Active", "account_balance": 1000.0}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data

def test_create_account():
    response = client.post(
        "/accounts/",
        json={"name": "Regular Account", "is_system_account": 0}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["name"] == "Regular Account"
    assert data["is_system_account"] == 0

def test_create_system_account():
    response = client.post(
        "/accounts/",
        json={"name": "System Account", "is_system_account": 1}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["name"] == "System Account"
    assert data["is_system_account"] == 1

def test_transaction_vat_logic_standard():
    # Setup accounts
    acc1 = client.post("/accounts/", json={"name": "Acc1", "is_system_account": 0}).json()
    acc2 = client.post("/accounts/", json={"name": "Acc2", "is_system_account": 0}).json()
    
    # Create transaction with VAT
    response = client.post(
        "/transactions/",
        json={
            "from_account_id": acc1["id"],
            "to_account_id": acc2["id"],
            "amount": 100.0,
            "vat_rate": 0.17
        }
    )
    assert response.status_code == 200
    data = response.json()
    # Should keep original VAT because no system account is involved
    assert float(data["vat_rate"]) == 0.17

def test_transaction_vat_logic_with_system_account():
    # Setup accounts
    sys_acc = client.post("/accounts/", json={"name": "SysAcc", "is_system_account": 1}).json()
    user_acc = client.post("/accounts/", json={"name": "UserAcc", "is_system_account": 0}).json()
    
    # Transaction FROM System Account -> VAT should be 0
    response1 = client.post(
        "/transactions/",
        json={
            "from_account_id": sys_acc["id"],
            "to_account_id": user_acc["id"],
            "amount": 100.0,
            "vat_rate": 0.17
        }
    )
    assert response1.status_code == 200
    assert float(response1.json()["vat_rate"]) == 0.0

    # Transaction TO System Account -> VAT should be 0
    response2 = client.post(
        "/transactions/",
        json={
            "from_account_id": user_acc["id"],
            "to_account_id": sys_acc["id"],
            "amount": 50.0,
            "vat_rate": 0.17
        }
    )
    assert response2.status_code == 200
    assert float(response2.json()["vat_rate"]) == 0.0
