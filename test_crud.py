"""
Tests for transaction CRUD lifecycle (Create, Read, Update, Delete).
"""


def test_transaction_crud_lifecycle(client, sample_project, sample_accounts):
    """Full CRUD cycle: create -> update -> delete a transaction."""
    regular = sample_accounts["regular"]
    pid = sample_project["id"]

    # 1. CREATE
    res = client.post("/transactions/", json={
        "project_id": pid,
        "date": "2025-06-01T00:00:00",
        "from_account_id": regular.id,
        "amount": 200.0,
        "vat_rate": 0.17,
        "transaction_type": 2,  # Planned
        "remarks": "Initial Remark",
    })
    assert res.status_code == 200
    tx = res.json()
    assert tx["transaction_type"] == 2
    assert tx["remarks"] == "Initial Remark"
    tx_id = tx["id"]

    # 2. UPDATE — change to Executed, update amount and remarks
    res = client.put(f"/transactions/{tx_id}", json={
        "project_id": pid,
        "date": "2025-06-15T00:00:00",
        "from_account_id": regular.id,
        "amount": 250.0,
        "transaction_type": 1,  # Executed
        "remarks": "Updated Remark",
    })
    assert res.status_code == 200
    updated = res.json()
    assert updated["transaction_type"] == 1
    assert updated["remarks"] == "Updated Remark"
    assert float(updated["amount"]) == 250.0

    # 3. DELETE
    res = client.delete(f"/transactions/{tx_id}")
    assert res.status_code == 200

    # 4. Verify it no longer appears in the list
    data = client.get("/transactions/").json()
    assert all(t["id"] != tx_id for t in data["items"])


def test_update_transaction_not_found(client):
    res = client.put("/transactions/99999", json={
        "date": "2025-01-01T00:00:00",
        "amount": 100.0,
    })
    assert res.status_code == 404


def test_delete_transaction_not_found(client):
    res = client.delete("/transactions/99999")
    assert res.status_code == 404
