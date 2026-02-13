"""
Tests for core API endpoints: projects, accounts, transactions, VAT logic.
"""
from datetime import datetime


# ── Projects ──────────────────────────────────────────────────────────


def test_create_project(client):
    response = client.post("/projects/", json={
        "name": "Test Project",
        "status": "Active",
        "account_balance": 1000.0,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert data["status"] == "Active"
    assert "id" in data


def test_list_projects(client, sample_project):
    response = client.get("/projects/")
    assert response.status_code == 200
    projects = response.json()
    assert len(projects) >= 1
    assert any(p["name"] == "Test Project" for p in projects)


def test_update_project(client, sample_project):
    pid = sample_project["id"]
    response = client.put(f"/projects/{pid}", json={
        "name": "Updated Project",
        "status": "Completed",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Project"
    assert data["status"] == "Completed"


def test_update_project_not_found(client):
    response = client.put("/projects/99999", json={"name": "Ghost"})
    assert response.status_code == 404


# ── Accounts (GET only — no POST endpoint) ───────────────────────────


def test_list_accounts(client, sample_accounts):
    response = client.get("/accounts/")
    assert response.status_code == 200
    accounts = response.json()
    assert len(accounts) == 2
    names = {a["name"] for a in accounts}
    assert "Regular Account" in names
    assert "System Account" in names


def test_list_accounts_empty(client):
    response = client.get("/accounts/")
    assert response.status_code == 200
    assert response.json() == []


# ── Transactions ──────────────────────────────────────────────────────


def test_create_transaction(client, sample_project, sample_accounts):
    response = client.post("/transactions/", json={
        "project_id": sample_project["id"],
        "date": "2025-03-01T00:00:00",
        "amount": 5000.0,
        "remarks": "Test expense",
        "transaction_type": 1,
        "type": "expense",
    })
    assert response.status_code == 200
    data = response.json()
    assert float(data["amount"]) == 5000.0
    assert data["remarks"] == "Test expense"


def test_list_transactions(client, sample_project):
    # Create two transactions
    for i in range(2):
        client.post("/transactions/", json={
            "project_id": sample_project["id"],
            "date": f"2025-0{i+1}-01T00:00:00",
            "amount": 100.0 * (i + 1),
        })
    response = client.get("/transactions/")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2


# ── VAT Logic ─────────────────────────────────────────────────────────


def test_vat_kept_for_regular_accounts(client, sample_accounts):
    """VAT should be preserved when both accounts are regular."""
    regular = sample_accounts["regular"]
    response = client.post("/transactions/", json={
        "date": "2025-01-15T00:00:00",
        "from_account_id": regular.id,
        "to_account_id": regular.id,
        "amount": 100.0,
        "vat_rate": 0.17,
    })
    assert response.status_code == 200
    assert float(response.json()["vat_rate"]) == 0.17


def test_vat_zeroed_for_system_from_account(client, sample_accounts):
    """VAT should be 0 when FROM account is a system account."""
    system = sample_accounts["system"]
    regular = sample_accounts["regular"]
    response = client.post("/transactions/", json={
        "date": "2025-01-15T00:00:00",
        "from_account_id": system.id,
        "to_account_id": regular.id,
        "amount": 100.0,
        "vat_rate": 0.17,
    })
    assert response.status_code == 200
    assert float(response.json()["vat_rate"]) == 0.0


def test_vat_zeroed_for_system_to_account(client, sample_accounts):
    """VAT should be 0 when TO account is a system account."""
    system = sample_accounts["system"]
    regular = sample_accounts["regular"]
    response = client.post("/transactions/", json={
        "date": "2025-01-15T00:00:00",
        "from_account_id": regular.id,
        "to_account_id": system.id,
        "amount": 50.0,
        "vat_rate": 0.17,
    })
    assert response.status_code == 200
    assert float(response.json()["vat_rate"]) == 0.0
