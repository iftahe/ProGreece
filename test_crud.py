from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest
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

def test_transaction_crud():
    # Setup
    proj = client.post("/projects/", json={"name": "Crud Project"}).json()
    acc = client.post("/accounts/", json={"name": "Crud Acc", "is_system_account": 0}).json()
    
    # 1. CREATE
    create_payload = {
        "project_id": proj["id"],
        "from_account_id": acc["id"],
        "amount": 200.0,
        "vat_rate": 0.17,
        "transaction_type": 2, # Planned
        "remarks": "Initial Remark"
    }
    res_create = client.post("/transactions/", json=create_payload)
    if res_create.status_code != 200:
        print(res_create.text)
    assert res_create.status_code == 200
    tx = res_create.json()
    assert tx["transaction_type"] == 2
    assert tx["remarks"] == "Initial Remark"
    tx_id = tx["id"]

    # 2. UPDATE
    update_payload = {
        "transaction_type": 1, # Executed
        "remarks": "Updated Remark",
        "amount": 250.0
    }
    # Note: PUT expects a full or partial schema. main.py uses TransactionCreate which has all fields optional in schema?
    # No, schemas.TransactionCreate inherits TransactionBase where fields are Optional.
    # But checking main.py: def update_transaction(... transaction: schemas.TransactionCreate ...)
    # So we should pass the structure.
    
    res_update = client.put(f"/transactions/{tx_id}", json=update_payload)
    if res_update.status_code != 200:
        print(res_update.text)
    assert res_update.status_code == 200
    updated_tx = res_update.json()
    assert updated_tx["transaction_type"] == 1
    assert updated_tx["remarks"] == "Updated Remark"
    assert float(updated_tx["amount"]) == 250.0

    # 3. DELETE
    res_delete = client.delete(f"/transactions/{tx_id}")
    assert res_delete.status_code == 200
    
    # Verify Gone
    res_get = client.get(f"/transactions/{tx_id}")
    assert res_get.status_code == 404
